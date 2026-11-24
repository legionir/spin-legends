import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { CharacterAppearance, PlayerSaveData, RankTierId } from './src/domain/types.ts';
import { RANK_TIERS } from './src/domain/rules.ts';
import {
  authenticateAccountCommander,
  claimSeasonTierReward,
  closeStore,
  getClaimedSeasonTiers,
  getCloudSaveForCommander,
  getCommanderById,
  getCurrentSeasonInfo,
  getLeaderboardList,
  getShadowOpponents,
  getStoreMetrics,
  issueSessionToken,
  registerAccountCommander,
  registerOrUpdateGuestCommander,
  sanitizeCommanderPublic,
  saveCloudProfileForCommander,
  verifySessionToken,
} from './src/server/store.ts';
import {
  getOnlineLobbySummary,
  handlePvpWebSocketConnection,
  shutdownPvpRooms,
} from './src/server/pvpRooms.ts';

interface AuthenticatedRequest extends Request {
  commanderId?: string;
}

// Per-IP sliding-window rate limiter
function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, number[]>();
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, hits] of buckets.entries()) {
      const active = hits.filter((t) => t > cutoff);
      if (active.length === 0) buckets.delete(ip);
      else buckets.set(ip, active);
    }
  }, Math.max(30_000, windowMs));
  cleanup.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;
    const prev = buckets.get(ip) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
      return;
    }
    recent.push(now);
    buckets.set(ip, recent);
    next();
  };
}

function sanitizeAppearance(raw: unknown): CharacterAppearance {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<CharacterAppearance>;
  const validStyles = ['spiky', 'sleek', 'braided', 'visor'];
  const hexOk = (v: unknown, fallback: string) =>
    typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
  return {
    hairStyle: validStyles.includes(String(input.hairStyle))
      ? (input.hairStyle as CharacterAppearance['hairStyle'])
      : 'spiky',
    hairColor: hexOk(input.hairColor, '#38bdf8'),
    outfitColor: hexOk(input.outfitColor, '#0f172a'),
    accentColor: hexOk(input.accentColor, '#f59e0b'),
  };
}

function extractBearerCommanderId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifySessionToken(token);
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const commanderId = extractBearerCommanderId(req);
  if (!commanderId || !getCommanderById(commanderId)) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }
  req.commanderId = commanderId;
  next();
}

function isValidCloudSavePayload(raw: unknown): raw is PlayerSaveData {
  if (!raw || typeof raw !== 'object') return false;
  const candidate = raw as Partial<PlayerSaveData>;
  return (
    typeof candidate.schemaVersion === 'number' &&
    Array.isArray(candidate.ownedTops) &&
    candidate.ownedTops.length > 0 &&
    typeof candidate.playerScore === 'number' &&
    Boolean(candidate.character && typeof candidate.character === 'object')
  );
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers (preserve SAMEORIGIN so embedded iframe preview works cleanly)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: https:; font-src 'self' data:; worker-src 'self' blob:;"
    );
    next();
  });

  app.use(express.json({ limit: '256kb' }));

  const authRateLimit = createRateLimiter(25, 60_000);
  const saveRateLimit = createRateLimiter(40, 60_000);

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storage: 'sqlite-wal',
      ...getStoreMetrics(),
      ...getOnlineLobbySummary(),
    });
  });

  app.post('/api/auth/session', authRateLimit, (req, res) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const mode =
      body.mode === 'register' || body.mode === 'login' ? body.mode : 'guest';
    const handle = typeof body.handle === 'string' ? body.handle.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : 'Arena Challenger';
    const passcode = typeof body.passcode === 'string' ? body.passcode : '';
    const existingPlayerId =
      typeof body.playerId === 'string' ? body.playerId.trim() : undefined;
    const guestSecret =
      typeof body.guestSecret === 'string' ? body.guestSecret.trim() : undefined;
    const appearance = sanitizeAppearance(body.appearance);

    if (mode === 'register') {
      const result = registerAccountCommander({
        handle,
        passcode,
        title,
        appearance,
      });
      if (!result.commander) {
        res.status(400).json({ error: result.error ?? 'Unable to register commander.' });
        return;
      }
      const token = issueSessionToken(result.commander.playerId);
      res.status(201).json({
        token,
        commander: sanitizeCommanderPublic(result.commander),
      });
      return;
    }

    if (mode === 'login') {
      const result = authenticateAccountCommander(handle, passcode);
      if (!result.commander) {
        res.status(401).json({ error: result.error ?? 'Authentication failed.' });
        return;
      }
      const token = issueSessionToken(result.commander.playerId);
      res.json({
        token,
        commander: sanitizeCommanderPublic(result.commander),
      });
      return;
    }

    const authenticatedPlayerId = extractBearerCommanderId(req);
    const guestResult = registerOrUpdateGuestCommander({
      playerId: existingPlayerId,
      guestSecret,
      authenticatedPlayerId,
      handle: handle || 'Commander',
      title,
      appearance,
    });
    const token = issueSessionToken(guestResult.commander.playerId);
    res.json({
      token,
      guestSecret: guestResult.guestSecret,
      commander: sanitizeCommanderPublic(guestResult.commander),
    });
  });

  app.get('/api/leaderboard', (req, res) => {
    const season = req.query.season === 'all' ? 'all' : 'current';
    res.json({
      season,
      seasonInfo: getCurrentSeasonInfo(),
      entries: getLeaderboardList(season),
    });
  });

  app.get('/api/season', (req, res) => {
    const season = getCurrentSeasonInfo();
    const commanderId = extractBearerCommanderId(req);
    const claimedTiers = commanderId
      ? getClaimedSeasonTiers(commanderId, season.seasonNumber)
      : [];
    res.json({
      season,
      tiers: RANK_TIERS,
      claimedTiers,
    });
  });

  app.post('/api/season/claim', saveRateLimit, requireAuth, (req: AuthenticatedRequest, res) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      tierId?: unknown;
    };
    const rawTierId = typeof body.tierId === 'string' ? body.tierId.trim() : '';
    const validTier = RANK_TIERS.find((t) => t.id === rawTierId);
    if (!validTier) {
      res.status(400).json({ error: 'Invalid rank tier id.' });
      return;
    }
    const result = claimSeasonTierReward(req.commanderId!, validTier.id as RankTierId);
    if (!result.ok) {
      res.status(400).json({
        error: result.error ?? 'Unable to claim season reward.',
        seasonNumber: result.seasonNumber,
        claimedTiers: result.claimedTiers,
      });
      return;
    }
    res.json({
      ok: true,
      seasonNumber: result.seasonNumber,
      tier: result.tier,
      claimedTiers: result.claimedTiers,
    });
  });

  app.get('/api/shadow-opponents', (req, res) => {
    const excludeId = extractBearerCommanderId(req) ?? undefined;
    res.json({
      opponents: getShadowOpponents(excludeId),
    });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json(getOnlineLobbySummary());
  });

  app.get('/api/save', requireAuth, (req: AuthenticatedRequest, res) => {
    const commanderId = req.commanderId!;
    const commander = getCommanderById(commanderId);
    if (!commander) {
      res.status(404).json({ error: 'Commander not found.' });
      return;
    }
    const save = getCloudSaveForCommander(commanderId);
    res.json({
      commander: sanitizeCommanderPublic(commander),
      save,
    });
  });

  app.put('/api/save', saveRateLimit, requireAuth, (req: AuthenticatedRequest, res) => {
    const commanderId = req.commanderId!;
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      save?: unknown;
    };
    if (!isValidCloudSavePayload(body.save)) {
      res.status(400).json({ error: 'Invalid cloud save payload.' });
      return;
    }
    const result = saveCloudProfileForCommander(commanderId, body.save);
    if (!result.commander) {
      const status = result.error?.includes('not found') ? 404 : 400;
      res.status(status).json({ error: result.error ?? 'Unable to sync cloud save.' });
      return;
    }
    res.json({
      ok: true,
      commander: sanitizeCommanderPublic(result.commander),
    });
  });

  // Error boundary for API routes
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status: number }).status) || 500
        : 500;
    res.status(status).json({ error: status === 413 ? 'Payload too large.' : 'Server error.' });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    handlePvpWebSocketConnection(ws);
  });

  httpServer.on('upgrade', (req, socket, head) => {
    const reqUrl = req.url ?? '';
    if (reqUrl === '/ws' || reqUrl.startsWith('/ws?')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { maxAge: '7d', index: false }));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(
      `[Spin Legends Server] Listening on http://0.0.0.0:${port} (${isProd ? 'production' : 'development'})`
    );
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[Spin Legends Server] Received ${signal}, draining connections...`);
    shutdownPvpRooms();
    wss.close();
    httpServer.close(() => {
      closeStore();
      process.exit(0);
    });
    setTimeout(() => {
      closeStore();
      process.exit(0);
    }, 3000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error(
    '[Spin Legends Server] Fatal startup failure:',
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
