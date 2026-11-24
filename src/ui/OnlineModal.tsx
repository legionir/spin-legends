import React, { useCallback, useEffect, useState } from 'react';
import {
  CloudDownload,
  CloudUpload,
  Copy,
  Check,
  Globe,
  LogIn,
  Play,
  RefreshCw,
  Shield,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
  AlertTriangle,
  Ghost,
  Eye,
  Flame,
  Clock,
  Sliders,
  Crosshair,
  Sparkles,
  Lock,
} from 'lucide-react';
import { ARENAS, getTopDefinition } from '../domain/catalog';
import {
  DEFAULT_BATTLE_MUTATORS,
  MUTATOR_DEFINITIONS,
  RANK_TIERS,
  buildSeededShadowOpponents,
  getActiveMutatorLabels,
  getCounterElement,
  getRankTier,
  getSeasonTierClaimKey,
} from '../domain/rules';
import type {
  ArenaId,
  BattleMutators,
  OwnedTopState,
  PlayerSaveData,
  RankTierId,
  RivalRecord,
  SeasonInfo,
  ShadowOpponentProfile,
} from '../domain/types';
import {
  authenticateOnlineSession,
  clearOnlineSession,
  downloadCloudSave,
  fetchOnlineLeaderboard,
  fetchOnlineLobbySummary,
  fetchSeasonInfo,
  fetchShadowOpponents,
  getOnlineSessionState,
  onlinePvpClient,
  uploadCloudSave,
  type OnlineCommanderPublic,
  type OnlineLobbySummary,
  type OnlineRoomView,
} from '../infrastructure/onlineClient';
import { sanitizeAndMigrateSave } from '../infrastructure/persistence';
import { CommanderAvatar } from './CommanderAvatar';

interface OnlineModalProps {
  save: PlayerSaveData;
  activeTop: OwnedTopState;
  currentRoom: OnlineRoomView | null;
  queueMode: 'OnlineFriendly' | 'OnlineRanked' | null;
  queuePosition: number;
  statusMessage: string | null;
  onClose: () => void;
  onConnectedUpdate: (commander: OnlineCommanderPublic | null) => void;
  onCloudSaveLoaded: (loaded: PlayerSaveData) => void;
  onJoinQueue: (mode: 'OnlineFriendly' | 'OnlineRanked', arenaId: ArenaId) => void;
  onLeaveQueue: () => void;
  onCreateRoom: (mode: 'OnlineFriendly' | 'OnlineRanked', arenaId: ArenaId, mutators?: BattleMutators) => void;
  onJoinRoom: (code: string, options?: { asSpectator?: boolean }) => void;
  onLeaveRoom: () => void;
  onStartRoomMatch: () => void;
  onChallengeShadow: (shadow: ShadowOpponentProfile, mutators?: BattleMutators) => void;
  onRevengeMatch: (rival: RivalRecord) => void;
  onOpenWorkshop: () => void;
  onClaimSeasonReward: (tierId: RankTierId) => Promise<boolean>;
}

interface CloudConflictPrompt {
  direction: 'upload' | 'download';
  cloudSave: PlayerSaveData;
  localScore: number;
  cloudScore: number;
  localWins: number;
  cloudWins: number;
}

export const OnlineModal: React.FC<OnlineModalProps> = ({
  save,
  activeTop,
  currentRoom,
  queueMode,
  queuePosition,
  statusMessage,
  onClose,
  onConnectedUpdate,
  onCloudSaveLoaded,
  onJoinQueue,
  onLeaveQueue,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onStartRoomMatch,
  onChallengeShadow,
  onRevengeMatch,
  onOpenWorkshop,
  onClaimSeasonReward,
}) => {
  const initialSession = getOnlineSessionState();
  const [commander, setCommander] = useState<OnlineCommanderPublic | null>(
    initialSession.commander
  );
  const [wsConnected, setWsConnected] = useState<boolean>(() => onlinePvpClient.isConnected());
  const [rttMs, setRttMs] = useState<number | null>(() => onlinePvpClient.getRttMs());
  const [browserOffline, setBrowserOffline] = useState<boolean>(() => !navigator.onLine);

  const [tab, setTab] = useState<'pvp' | 'shadow' | 'league' | 'cloud'>('pvp');
  const [authMode, setAuthMode] = useState<'guest' | 'login' | 'register'>('guest');
  const [handleInput, setHandleInput] = useState(save.character.name || 'Commander');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [selectedArenaId, setSelectedArenaId] = useState<ArenaId>(save.selectedArenaId);
  const [matchMode, setMatchMode] = useState<'OnlineRanked' | 'OnlineFriendly'>('OnlineRanked');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const [friendlyMutators, setFriendlyMutators] = useState<BattleMutators>({
    ...DEFAULT_BATTLE_MUTATORS,
  });
  const [shadowMutators, setShadowMutators] = useState<BattleMutators>({
    ...DEFAULT_BATTLE_MUTATORS,
  });

  const [lobbySummary, setLobbySummary] = useState<OnlineLobbySummary | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<'current' | 'all'>('current');
  const [leaderboard, setLeaderboard] = useState<OnlineCommanderPublic[]>([]);
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [seasonClaimedTiers, setSeasonClaimedTiers] = useState<RankTierId[]>([]);
  const [shadowOpponents, setShadowOpponents] = useState<ShadowOpponentProfile[]>([]);
  const [loadingShadows, setLoadingShadows] = useState<boolean>(false);
  const [claimingTier, setClaimingTier] = useState<RankTierId | null>(null);

  const [loadingLeague, setLoadingLeague] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudConflict, setCloudConflict] = useState<CloudConflictPrompt | null>(null);

  const refreshLobby = useCallback(async () => {
    if (!navigator.onLine) return;
    const res = await fetchOnlineLobbySummary();
    if (res.summary) setLobbySummary(res.summary);
  }, []);

  const refreshLeaderboard = useCallback(async (season: 'current' | 'all') => {
    if (!navigator.onLine) return;
    setLoadingLeague(true);
    const res = await fetchOnlineLeaderboard(season);
    setLoadingLeague(false);
    if (res.error) {
      setFeedback({ kind: 'err', text: res.error });
    } else {
      setLeaderboard(res.entries);
      if (res.seasonInfo) {
        setSeasonInfo(res.seasonInfo);
      }
    }
  }, []);

  const loadSeason = useCallback(async () => {
    if (!navigator.onLine) return;
    const res = await fetchSeasonInfo();
    if (res.season) {
      setSeasonInfo(res.season);
    }
    if (res.claimedTiers) {
      setSeasonClaimedTiers(res.claimedTiers);
    }
  }, []);

  const loadShadows = useCallback(async () => {
    setLoadingShadows(true);
    const res = await fetchShadowOpponents();
    if (res.opponents && res.opponents.length > 0) {
      setShadowOpponents(res.opponents);
    } else {
      setShadowOpponents(buildSeededShadowOpponents());
    }
    setLoadingShadows(false);
  }, []);

  useEffect(() => {
    void refreshLobby();
    void refreshLeaderboard(seasonFilter);
    void loadSeason();
  }, [refreshLobby, refreshLeaderboard, loadSeason, seasonFilter]);

  useEffect(() => {
    if (tab === 'shadow' && shadowOpponents.length === 0) {
      void loadShadows();
    }
  }, [tab, shadowOpponents.length, loadShadows]);

  useEffect(() => {
    const onOffline = () => setBrowserOffline(true);
    const onOnline = () => {
      setBrowserOffline(false);
      void refreshLobby();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (cloudConflict) {
          setCloudConflict(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [cloudConflict, onClose, refreshLobby]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWsConnected(onlinePvpClient.isConnected());
      setRttMs(onlinePvpClient.getRttMs());
    }, 600);
    return () => clearInterval(interval);
  }, []);

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (browserOffline) {
      setFeedback({ kind: 'err', text: 'Cannot authenticate while offline.' });
      return;
    }
    setAuthBusy(true);
    setFeedback(null);
    const res = await authenticateOnlineSession({
      mode: authMode,
      handle: handleInput,
      passcode: authMode === 'guest' ? undefined : passcodeInput,
      title: save.character.title,
      appearance: save.character.appearance,
      existingPlayerId: save.playerId,
    });
    if (!res.commander) {
      setAuthBusy(false);
      setFeedback({ kind: 'err', text: res.error ?? 'Connection failed.' });
      return;
    }

    const wsOk = await onlinePvpClient.connect();
    setCommander(res.commander);
    setWsConnected(wsOk);
    setRttMs(onlinePvpClient.getRttMs());
    onConnectedUpdate(res.commander);
    setAuthBusy(false);
    setPasscodeInput('');
    setFeedback({
      kind: wsOk ? 'ok' : 'err',
      text: wsOk
        ? `Connected as ${res.commander.handle} (MMR ${res.commander.mmr}).`
        : 'Authenticated via REST, but WebSocket channel could not connect.',
    });
    void refreshLobby();
    void refreshLeaderboard(seasonFilter);
  };

  const handleSignOut = () => {
    onlinePvpClient.disconnect();
    clearOnlineSession();
    setCommander(null);
    setWsConnected(false);
    setRttMs(null);
    onConnectedUpdate(null);
    setFeedback({ kind: 'ok', text: 'Disconnected from Online Arena.' });
  };

  const countWins = (s: PlayerSaveData) =>
    s.ownedTops.reduce((sum, t) => sum + (t.wins ?? 0), 0);

  const performUploadCloudSave = async () => {
    setCloudBusy(true);
    setFeedback(null);
    const res = await uploadCloudSave(save);
    setCloudBusy(false);
    setCloudConflict(null);
    if (!res.ok) {
      setFeedback({ kind: 'err', text: res.error ?? 'Upload failed.' });
    } else {
      if (res.commander) {
        setCommander(res.commander);
        onConnectedUpdate(res.commander);
      }
      setFeedback({ kind: 'ok', text: 'Local profile synced cleanly to Cloud Save.' });
      void refreshLeaderboard(seasonFilter);
    }
  };

  const applyDownloadedCloudSave = (cloudSave: PlayerSaveData) => {
    setCloudConflict(null);
    onCloudSaveLoaded(cloudSave);
    setFeedback({ kind: 'ok', text: 'Cloud Save restored to local browser storage.' });
  };

  const handleUploadCloudSave = async () => {
    if (browserOffline) return;
    setCloudBusy(true);
    setFeedback(null);
    const existing = await downloadCloudSave();
    setCloudBusy(false);
    if (existing.save) {
      const sanitizedCloud = sanitizeAndMigrateSave(existing.save);
      if (sanitizedCloud) {
        const localWins = countWins(save);
        const cloudWins = countWins(sanitizedCloud);
        const diverges =
          sanitizedCloud.playerScore > save.playerScore ||
          cloudWins > localWins;
        if (diverges) {
          setCloudConflict({
            direction: 'upload',
            cloudSave: sanitizedCloud,
            localScore: save.playerScore,
            cloudScore: sanitizedCloud.playerScore,
            localWins,
            cloudWins,
          });
          return;
        }
      }
    }
    await performUploadCloudSave();
  };

  const handleDownloadCloudSave = async () => {
    if (browserOffline) return;
    setCloudBusy(true);
    setFeedback(null);
    const res = await downloadCloudSave();
    setCloudBusy(false);
    if (res.error) {
      setFeedback({ kind: 'err', text: res.error });
      return;
    }
    if (!res.save) {
      setFeedback({ kind: 'err', text: 'No Cloud Save found for this Commander yet.' });
      return;
    }
    const sanitized = sanitizeAndMigrateSave(res.save);
    if (!sanitized) {
      setFeedback({ kind: 'err', text: 'Cloud Save payload could not be validated.' });
      return;
    }
    const localWins = countWins(save);
    const cloudWins = countWins(sanitized);
    if (save.playerScore > sanitized.playerScore || localWins > cloudWins) {
      setCloudConflict({
        direction: 'download',
        cloudSave: sanitized,
        localScore: save.playerScore,
        cloudScore: sanitized.playerScore,
        localWins,
        cloudWins,
      });
      return;
    }
    applyDownloadedCloudSave(sanitized);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Clipboard restricted in iframe
    }
  };

  const activeTopDef = getTopDefinition(activeTop.definitionId);
  const isHost = Boolean(currentRoom && commander && currentRoom.hostPlayerId === commander.playerId);
  const isSpectatingRoom = Boolean(
    currentRoom &&
      commander &&
      currentRoom.spectators?.some((s) => s.playerId === commander.playerId)
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 sl-safe-inset backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.70)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Online Arena and Global League"
        className="sl-panel-modal w-full max-w-4xl max-h-[92vh] rounded-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="sl-ls-modal-header px-4 sm:px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold flex items-center gap-2 uppercase tracking-wider">
              <Globe className="w-5 h-5 text-sky-400 shrink-0" />
              <span className="truncate sl-title-metal">Online Arena & Global League</span>
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Authoritative 50Hz WebSocket PvP · Synced Launch · Ranked MMR & SQLite Cloud Sync
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 border tabular-nums ${
                browserOffline
                  ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                  : wsConnected
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {browserOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  OFFLINE
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  {wsConnected ? `LIVE WS${rttMs ? ` · ${rttMs}ms` : ''}` : 'DISCONNECTED'}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Online Arena"
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="sl-hairline" />

        {/* Offline Notice */}
        {browserOffline && (
          <div className="px-5 py-2 border-b border-amber-500/40 bg-amber-950/40 text-amber-200 text-xs font-semibold flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            You are offline. Local Solo modes & Workshop work normally; Online PvP and Cloud Sync resume once reconnected.
          </div>
        )}

        {/* Commander Auth Bar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60">
          {!commander ? (
            <form onSubmit={handleAuthenticate} className="flex flex-wrap items-end gap-2.5">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                  Session Type
                </div>
                <div className="flex rounded-lg overflow-hidden border border-slate-700">
                  {(
                    [
                      { id: 'guest', label: 'Instant Guest' },
                      { id: 'login', label: 'Sign In' },
                      { id: 'register', label: 'Register' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAuthMode(m.id)}
                      className={`px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                        authMode === m.id
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-w-[150px]">
                <label
                  htmlFor="online-commander-handle"
                  className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1"
                >
                  Commander Handle
                </label>
                <input
                  id="online-commander-handle"
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  maxLength={24}
                  required
                  placeholder="Commander handle..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              {authMode !== 'guest' && (
                <div className="w-40">
                  <label
                    htmlFor="online-commander-passcode"
                    className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1"
                  >
                    Passcode
                  </label>
                  <input
                    id="online-commander-passcode"
                    type="password"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    minLength={4}
                    maxLength={32}
                    required
                    placeholder="4+ chars"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-amber px-4 py-2 disabled:opacity-50 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {authMode === 'register' ? (
                  <UserPlus className="w-3.5 h-3.5" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                {authBusy ? 'Connecting...' : 'Enter Arena'}
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CommanderAvatar appearance={commander.appearance} size={38} />
                <div>
                  <div className="text-sm font-extrabold text-white flex items-center gap-2">
                    {commander.handle}
                    <span className="font-mono-tech px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black tabular-nums">
                      {commander.mmr} MMR
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {commander.title} · <span className="font-mono-tech">{commander.wins}W - {commander.losses}L</span> · Top:{' '}
                    <span className="text-sky-300 font-semibold">{activeTopDef.displayName}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-rose-300 cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          )}

          {(feedback || statusMessage) && (
            <div
              className={`mt-2.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                feedback?.kind === 'err'
                  ? 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                  : 'border-sky-500/40 bg-sky-950/35 text-sky-200'
              }`}
            >
              {feedback?.text ?? statusMessage}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('pvp')}
              className={`sl-btn-3d sl-btn-3d-sm px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === 'pvp' ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              PvP Matchmaking & Rooms
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('shadow');
                if (shadowOpponents.length === 0) void loadShadows();
              }}
              className={`sl-btn-3d sl-btn-3d-sm px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === 'shadow' ? 'sl-btn-3d-violet' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <Ghost className="w-3.5 h-3.5" />
              Shadow Arena & Rivals ({save.rivals?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('league');
                void refreshLeaderboard(seasonFilter);
                void loadSeason();
              }}
              className={`sl-btn-3d sl-btn-3d-sm px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === 'league' ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Seasonal League & Ranks
            </button>
            <button
              type="button"
              onClick={() => setTab('cloud')}
              className={`sl-btn-3d sl-btn-3d-sm px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === 'cloud' ? 'sl-btn-3d-emerald' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Cloud Save Sync
            </button>
          </div>

          {lobbySummary && (
            <div className="font-mono-tech text-[11px] text-slate-400 tabular-nums font-semibold">
              Active Rooms: <strong className="text-slate-200">{lobbySummary.activeRooms}</strong> ·
              Ranked Queue: <strong className="text-amber-300">{lobbySummary.rankedQueueSize}</strong>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto sl-scroll p-5">
          {tab === 'pvp' && (
            <div className="space-y-4">
              {currentRoom ? (
                <div className="p-4 rounded-xl border border-sky-400/60 bg-sky-950/20 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-sky-300 font-extrabold">
                        Active Room · {currentRoom.mode === 'OnlineRanked' ? 'Ranked MMR' : 'Friendly'}
                      </div>
                      <div className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                        Room Code:{' '}
                        <span className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 tracking-widest tabular-nums">
                          {currentRoom.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyCode(currentRoom.code)}
                          className="p-1.5 rounded border border-slate-700 bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
                          aria-label="Copy room code"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onLeaveRoom}
                      className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-rose-300 cursor-pointer"
                    >
                      Leave Room
                    </button>
                  </div>

                  {currentRoom.mutators && getActiveMutatorLabels(currentRoom.mutators).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Mutators:
                      </span>
                      {getActiveMutatorLabels(currentRoom.mutators).map((lbl) => (
                        <span
                          key={lbl}
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300"
                        >
                          {lbl}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentRoom.spectators && currentRoom.spectators.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-purple-300 font-semibold bg-purple-950/30 border border-purple-800/40 px-3 py-1.5 rounded-lg">
                      <Eye className="w-3.5 h-3.5 text-purple-400" />
                      <span>Spectators ({currentRoom.spectators.length}):</span>
                      <span className="text-slate-300">
                        {currentRoom.spectators.map((s) => s.handle).join(', ')}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[0, 1].map((slotIdx) => {
                      const member = currentRoom.members[slotIdx];
                      if (!member) {
                        return (
                          <div
                            key={slotIdx}
                            className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 flex items-center justify-center text-xs text-slate-500 font-semibold"
                          >
                            Waiting for Rival Commander to join with code {currentRoom.code}...
                          </div>
                        );
                      }
                      const mTop = getTopDefinition(member.build.topDefinitionId);
                      return (
                        <div
                          key={member.playerId}
                          className="p-3.5 rounded-xl border border-slate-700 bg-slate-900/80 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-extrabold text-white flex items-center gap-2">
                              {member.handle}
                              {member.playerId === currentRoom.hostPlayerId && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300">
                                  HOST
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {mTop.displayName} (Lv.{member.build.level}) · {member.mmr} MMR
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                            READY
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {isSpectatingRoom ? (
                    <div className="text-center text-xs text-purple-300 font-bold flex items-center justify-center gap-1.5">
                      <Eye className="w-4 h-4 text-purple-400" />
                      Spectator Broadcast Connected! Match starts automatically when host launches.
                    </div>
                  ) : isHost ? (
                    <button
                      type="button"
                      disabled={currentRoom.members.length < 2}
                      onClick={onStartRoomMatch}
                      className={`sl-btn-3d sl-chamfer w-full py-3 font-display font-bold text-sm flex items-center justify-center gap-2 ${
                        currentRoom.members.length < 2
                          ? 'sl-btn-3d-slate opacity-50 cursor-not-allowed'
                          : 'sl-btn-3d-amber cursor-pointer'
                      }`}
                    >
                      <Play className="w-4 h-4" />
                      {currentRoom.members.length === 2
                        ? 'Initiate 5s Synchronized Launch'
                        : 'Waiting for 2nd Challenger...'}
                    </button>
                  ) : (
                    <div className="text-center text-xs text-sky-300 font-bold">
                      Connected to room! Waiting for host to trigger the 5s Synchronized Launch...
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Mode & Arena Setup */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-3">
                      <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                        1. Battle Mode & Matchmaking
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMatchMode('OnlineRanked')}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                            matchMode === 'OnlineRanked'
                              ? 'border-amber-400 bg-amber-950/30'
                              : 'border-slate-700 bg-slate-950/60'
                          }`}
                        >
                          <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            Ranked MMR
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Updates global ELO & Seasonal League
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatchMode('OnlineFriendly')}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                            matchMode === 'OnlineFriendly'
                              ? 'border-sky-400 bg-sky-950/30'
                              : 'border-slate-700 bg-slate-950/60'
                          }`}
                        >
                          <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-sky-400" />
                            Friendly Duel
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Unranked skirmish & custom mutators
                          </div>
                        </button>
                      </div>

                      {matchMode === 'OnlineFriendly' && (
                        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                            <Sliders className="w-3 h-3 text-sky-400" />
                            Friendly Battle Mutators
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {MUTATOR_DEFINITIONS.map((m) => {
                              const active = Boolean(friendlyMutators[m.id]);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() =>
                                    setFriendlyMutators((prev) => ({
                                      ...prev,
                                      [m.id]: !prev[m.id],
                                    }))
                                  }
                                  className={`p-1.5 rounded text-left border text-[11px] font-bold cursor-pointer transition ${
                                    active
                                      ? 'border-amber-400 bg-amber-950/40 text-amber-200'
                                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  <div>{m.label}</div>
                                  <div className="text-[9px] text-slate-500 font-normal">
                                    {m.description}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="online-preferred-arena"
                          className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1"
                        >
                          Preferred Arena
                        </label>
                        <select
                          id="online-preferred-arena"
                          value={selectedArenaId}
                          onChange={(e) => setSelectedArenaId(e.target.value as ArenaId)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white"
                        >
                          {Object.values(ARENAS).map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.displayName} — {a.hazardSummary}
                            </option>
                          ))}
                        </select>
                      </div>

                      {queueMode ? (
                        <button
                          type="button"
                          onClick={onLeaveQueue}
                          className="sl-btn-3d sl-btn-3d-crimson w-full min-h-[44px] py-2.5 text-xs font-display font-bold cursor-pointer"
                        >
                          Searching {queueMode === 'OnlineRanked' ? 'Ranked' : 'Friendly'} (Pos #{queuePosition}) · Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!wsConnected || browserOffline}
                          onClick={() => onJoinQueue(matchMode, selectedArenaId)}
                          className={`sl-btn-3d sl-chamfer w-full min-h-[44px] py-2.5 text-xs font-display font-bold flex items-center justify-center gap-1.5 ${
                            !wsConnected || browserOffline
                              ? 'sl-btn-3d-slate opacity-50 cursor-not-allowed'
                              : 'sl-btn-3d-amber cursor-pointer'
                          }`}
                        >
                          <Swords className="w-4 h-4" />
                          {browserOffline
                            ? 'Offline Mode'
                            : wsConnected
                              ? `Find ${matchMode === 'OnlineRanked' ? 'Ranked' : 'Friendly'} Match`
                              : 'Sign In Above to Queue'}
                        </button>
                      )}
                    </div>

                    {/* Private Room Codes */}
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-3">
                      <div className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                        <span>2. Private Room Lobby</span>
                        <button
                          type="button"
                          onClick={() => void refreshLobby()}
                          className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Refresh
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={!wsConnected || browserOffline}
                        onClick={() =>
                          onCreateRoom(
                            matchMode,
                            selectedArenaId,
                            matchMode === 'OnlineFriendly' ? friendlyMutators : undefined
                          )
                        }
                        className={`sl-btn-3d w-full min-h-[44px] py-2 text-xs font-display font-bold flex items-center justify-center gap-1.5 ${
                          !wsConnected || browserOffline
                            ? 'sl-btn-3d-slate opacity-50 cursor-not-allowed'
                            : 'sl-btn-3d-cyan cursor-pointer'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        Create Private Room Code
                      </button>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={roomCodeInput}
                          onChange={(e) => setRoomCodeInput(e.target.value)}
                          placeholder="Enter 6-digit code..."
                          maxLength={8}
                          className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white tracking-widest tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={!wsConnected || browserOffline || roomCodeInput.trim().length < 4}
                          onClick={() => onJoinRoom(roomCodeInput.trim())}
                          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[40px] px-3.5 py-1.5 disabled:opacity-45 text-xs font-bold cursor-pointer"
                        >
                          Join
                        </button>
                        <button
                          type="button"
                          disabled={!wsConnected || browserOffline || roomCodeInput.trim().length < 4}
                          onClick={() => onJoinRoom(roomCodeInput.trim(), { asSpectator: true })}
                          title="Spectate Friendly Room by Code"
                          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-violet min-h-[40px] px-3 py-1.5 disabled:opacity-45 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Watch
                        </button>
                      </div>

                      {/* Open Rooms */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          Open Rooms ({lobbySummary?.openRooms.length ?? 0})
                        </div>
                        {lobbySummary && lobbySummary.openRooms.length > 0 ? (
                          lobbySummary.openRooms.map((rm) => (
                            <div
                              key={rm.roomId}
                              className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-white">{rm.hostHandle}</span>{' '}
                                <span className="text-slate-400">
                                  ({rm.hostMmr} MMR · {rm.mode === 'OnlineRanked' ? 'Ranked' : 'Friendly'})
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={!wsConnected}
                                onClick={() => onJoinRoom(rm.code)}
                                className="px-2.5 py-1 rounded bg-sky-400/20 border border-sky-400/50 text-sky-300 font-bold hover:bg-sky-400 hover:text-slate-950 disabled:opacity-40 cursor-pointer"
                              >
                                Join #{rm.code}
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-500">
                            No open waiting rooms right now — create one or enter Queue matchmaking!
                          </div>
                        )}
                      </div>

                      {/* Live Spectatable Rooms */}
                      {lobbySummary?.spectatableRooms && lobbySummary.spectatableRooms.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800">
                          <div className="text-[10px] uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Live Spectator Broadcasts ({lobbySummary.spectatableRooms.length})
                          </div>
                          {lobbySummary.spectatableRooms.map((rm) => (
                            <div
                              key={`spec-${rm.code}`}
                              className="px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-950/20 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-white">
                                  {rm.p1Handle} vs {rm.p2Handle}
                                </span>{' '}
                                <span className="text-slate-400">
                                  ({ARENAS[rm.arenaId]?.displayName ?? rm.arenaId} · {rm.spectatorCount} watching)
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={!wsConnected}
                                onClick={() => onJoinRoom(rm.code, { asSpectator: true })}
                                className="px-2.5 py-1 rounded bg-purple-500/20 border border-purple-500/50 text-purple-200 font-bold hover:bg-purple-500 hover:text-white disabled:opacity-40 cursor-pointer flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Watch #{rm.code}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'shadow' && (
            <div className="space-y-5">
              {/* Section 1: Shadow Arena */}
              <div className="p-4 rounded-xl border border-purple-500/40 bg-purple-950/20 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-purple-300 font-extrabold flex items-center gap-1.5">
                      <Ghost className="w-4 h-4 text-purple-400" />
                      Shadow Arena (Asynchronous PvP Champions)
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Challenge recorded builds and specialized AI personalities of top leaderboard commanders from the SQLite database.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadShadows()}
                    className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3 py-1.5 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingShadows ? 'animate-spin' : ''}`} />
                    Refresh Shadows
                  </button>
                </div>

                {/* Optional Mutators for Shadow Battle */}
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-purple-400" />
                    Challenge Mutators (Optional)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {MUTATOR_DEFINITIONS.map((m) => {
                      const active = Boolean(shadowMutators[m.id]);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setShadowMutators((prev) => ({
                              ...prev,
                              [m.id]: !prev[m.id],
                            }))
                          }
                          className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition ${
                            active
                              ? 'border-purple-400 bg-purple-900/50 text-purple-200'
                              : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shadow Opponents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {shadowOpponents.map((opp) => {
                    const topDef = getTopDefinition(opp.topDefinitionId);
                    const rank = getRankTier(opp.mmr);
                    return (
                      <div
                        key={opp.playerId}
                        className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-2.5 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CommanderAvatar appearance={opp.appearance} size={40} />
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-white flex items-center gap-1.5 truncate">
                                {opp.handle}
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                                  SHADOW
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 truncate">
                                {opp.title} · {topDef.displayName} (Lv.{opp.level})
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                              style={{ backgroundColor: `${rank.colorHex}20`, color: rank.colorHex }}
                            >
                              {rank.name}
                            </span>
                            <div className="text-xs font-bold text-amber-300 mt-1 tabular-nums">
                              {opp.mmr} MMR
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 font-semibold">{opp.element}</span>
                            <span>·</span>
                            <span className="text-purple-300 font-medium">{opp.aiPersonality}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onChallengeShadow(opp, shadowMutators)}
                            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-violet px-3 py-1.5 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Swords className="w-3.5 h-3.5" />
                            Challenge Shadow
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Rivals & Rematch Feed */}
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/15 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-rose-300 font-extrabold flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-400" />
                      Rivals & Rematch Feed ({save.rivals?.length ?? 0}/12)
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Opponents who handed you a defeat. Analyze their elemental affinity and deploy a customized counter build.
                    </p>
                  </div>
                </div>

                {!save.rivals || save.rivals.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-slate-800 bg-slate-900/40">
                    <Crosshair className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <div className="text-xs font-bold text-slate-300">No active rivals</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Defeats in Ranked PvP or Shadow Arena will register rivals here with elemental counter recommendations.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {save.rivals.map((rival) => {
                      const topDef = getTopDefinition(rival.topDefinitionId);
                      const counterElem = getCounterElement(rival.element);
                      const isAvenged = rival.status === 'avenged';
                      return (
                        <div
                          key={rival.id}
                          className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {rival.appearance && (
                              <CommanderAvatar appearance={rival.appearance} size={36} />
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-white flex items-center gap-2 truncate">
                                {rival.handle}
                                <span
                                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                    isAvenged
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {isAvenged ? (
                                    <>
                                      <Check className="w-2.5 h-2.5" /> AVENGED
                                    </>
                                  ) : (
                                    <>
                                      <Flame className="w-2.5 h-2.5" /> {rival.lossesToRival} DEFEAT
                                      {rival.lossesToRival > 1 ? 'S' : ''}
                                    </>
                                  )}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                Top: {topDef.displayName} · Element:{' '}
                                <strong className="text-slate-200">{rival.element}</strong> · Last:{' '}
                                {new Date(rival.lastEncounterMs).toLocaleDateString()}
                              </div>
                              <div className="text-[11px] text-amber-300 font-semibold mt-0.5 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                Recommended Counter: <strong className="text-white">{counterElem}</strong> (+25% power)
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={onOpenWorkshop}
                              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
                            >
                              Tune Counter
                            </button>
                            <button
                              type="button"
                              onClick={() => onRevengeMatch(rival)}
                              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-crimson px-3 py-1.5 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Swords className="w-3.5 h-3.5" />
                              Revenge Match
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'league' && (
            <div className="space-y-4">
              {/* Competitive Season Banner & Tier Milestone Track */}
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 space-y-4">
                {(() => {
                  const msLeft = seasonInfo ? Math.max(0, seasonInfo.endsAtMs - Date.now()) : 28 * 86400_000;
                  const remDays = Math.floor(msLeft / (24 * 3600_000));
                  const remHours = Math.floor((msLeft % (24 * 3600_000)) / 3600_000);
                  const seasonNum = seasonInfo?.seasonNumber ?? 1;
                  const playerMmr = commander?.mmr ?? save.pvpMmr ?? 1000;
                  const currentTier = getRankTier(playerMmr);
                  const currentTierIdx = RANK_TIERS.findIndex((t) => t.id === currentTier.id);
                  const nextTier = RANK_TIERS[currentTierIdx + 1];
                  const progressPct = nextTier
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          ((playerMmr - currentTier.minMmr) /
                            (nextTier.minMmr - currentTier.minMmr)) *
                            100
                        )
                      )
                    : 100;

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-amber-400 font-extrabold flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5" />
                            {seasonInfo?.seasonName ?? `Season ${seasonNum}: Genesis Vortex`}
                          </div>
                          <h3 className="text-base font-black text-white mt-0.5">
                            Competitive Ranked Season
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            {remDays}d {remHours}h Remaining
                          </span>
                        </div>
                      </div>

                      {/* Player Current Rank Tier and Progress */}
                      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider border"
                              style={{
                                backgroundColor: `${currentTier.colorHex}25`,
                                color: currentTier.colorHex,
                                borderColor: `${currentTier.colorHex}50`,
                              }}
                            >
                              {currentTier.name}
                            </span>
                            <span className="text-sm font-black text-white tabular-nums">
                              {playerMmr} MMR
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-bold">
                            {nextTier ? (
                              <span>
                                Next: <strong className="text-white">{nextTier.name}</strong>{' '}
                                ({nextTier.minMmr} MMR)
                              </span>
                            ) : (
                              <span className="text-amber-300 font-black">MAX TIER REACHED</span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="sl-bar-track w-full h-2.5 rounded-full overflow-hidden">
                          <div
                            className="sl-bar-fill h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressPct}%`,
                              backgroundColor: currentTier.colorHex,
                            }}
                          />
                        </div>
                      </div>

                      {/* 6-Tier Milestone Rewards Track */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                          <span>Season Milestone Tier Rewards</span>
                          <span className="text-slate-500">Unlocks upon reaching required MMR</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {RANK_TIERS.map((tier) => {
                            const reached = playerMmr >= tier.minMmr;
                            const claimKey = getSeasonTierClaimKey(seasonNum, tier.id);
                            const claimed =
                              seasonClaimedTiers.includes(tier.id) ||
                              (save.claimedSeasonRewardTiers ?? []).includes(claimKey) ||
                              (save.claimedSeasonRewardTiers ?? []).includes(tier.id);
                            const isClaiming = claimingTier === tier.id;

                            const handleClaim = async () => {
                              setClaimingTier(tier.id);
                              const ok = await onClaimSeasonReward(tier.id);
                              setClaimingTier(null);
                              if (ok) {
                                setSeasonClaimedTiers((prev) =>
                                  Array.from(new Set([...prev, tier.id]))
                                );
                                setFeedback({
                                  kind: 'ok',
                                  text: `Claimed ${tier.name} season tier milestone reward!`,
                                });
                              } else {
                                setFeedback({
                                  kind: 'err',
                                  text: `Sign in and reach ${tier.minMmr} MMR to claim ${tier.name} reward.`,
                                });
                              }
                            };

                            return (
                              <div
                                key={tier.id}
                                className={`p-2.5 rounded-lg border text-center space-y-1.5 flex flex-col justify-between ${
                                  claimed
                                    ? 'border-emerald-500/40 bg-emerald-950/20'
                                    : reached
                                      ? 'border-amber-400/80 bg-amber-950/30 ring-1 ring-amber-400/30'
                                      : 'border-slate-800 bg-slate-950/60 opacity-60'
                                }`}
                              >
                                <div>
                                  <div
                                    className="text-[10px] font-black uppercase tracking-wider"
                                    style={{ color: tier.colorHex }}
                                  >
                                    {tier.name}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-bold tabular-nums">
                                    {tier.minMmr} MMR
                                  </div>
                                </div>

                                <div className="text-[9px] text-slate-300 font-semibold space-y-0.5">
                                  <div>+{tier.rewardGold} Gold</div>
                                  <div>+{tier.rewardCrystals} Crystals</div>
                                  {tier.rewardFragments > 0 && (
                                    <div className="text-purple-300 font-bold">
                                      +{tier.rewardFragments} Fragments
                                    </div>
                                  )}
                                </div>

                                {claimed ? (
                                  <span className="text-[10px] font-black text-emerald-400 flex items-center justify-center gap-1">
                                    <Check className="w-3 h-3" /> Claimed
                                  </span>
                                ) : reached ? (
                                  <button
                                    type="button"
                                    disabled={isClaiming}
                                    onClick={() => void handleClaim()}
                                    className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-amber w-full py-1 text-[10px] font-display font-bold cursor-pointer"
                                  >
                                    {isClaiming ? 'Claiming...' : 'Claim'}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-bold flex items-center justify-center gap-1">
                                    <Lock className="w-3 h-3" /> Locked
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Leaderboard Table */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSeasonFilter('current')}
                    className={`sl-btn-3d sl-btn-3d-sm px-3 py-1 text-xs font-bold cursor-pointer ${
                      seasonFilter === 'current' ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate text-slate-300'
                    }`}
                  >
                    Current Season MMR
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeasonFilter('all')}
                    className={`sl-btn-3d sl-btn-3d-sm px-3 py-1 text-xs font-bold cursor-pointer ${
                      seasonFilter === 'all' ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate text-slate-300'
                    }`}
                  >
                    All-Time Hall of Fame
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshLeaderboard(seasonFilter)}
                  className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3 py-1 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLeague ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className="space-y-2">
                {leaderboard.map((entry, idx) => {
                  const isYou = commander?.playerId === entry.playerId;
                  return (
                    <div
                      key={entry.playerId}
                      className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isYou
                          ? 'border-sky-400 bg-sky-950/30'
                          : 'border-slate-800 bg-slate-900/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black tabular-nums shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950'
                              : idx === 1
                                ? 'bg-slate-300 text-slate-950'
                                : idx === 2
                                  ? 'bg-orange-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          #{idx + 1}
                        </div>
                        <CommanderAvatar appearance={entry.appearance} size={34} />
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-white truncate flex items-center gap-2">
                            {entry.handle}
                            {isYou && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 tabular-nums">
                            {entry.title} · {entry.wins}W - {entry.losses}L · {entry.secretsFound} Secrets
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-black text-amber-300 tabular-nums">
                          {entry.mmr} <span className="text-[10px] font-semibold">MMR</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold tabular-nums">
                          {seasonFilter === 'current' ? entry.seasonScore : entry.bestScore} PTS · {entry.endingBadge}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'cloud' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-3">
                <div className="text-sm font-extrabold text-white">
                  Persistent Cloud Profile Synchronization
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Back up your character, score log, unlocked tops, forged mythic parts, and story endings to the Arena SQLite server. Requires an authenticated Commander session above.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    disabled={!commander || cloudBusy || browserOffline}
                    onClick={() => void handleUploadCloudSave()}
                    className={`sl-btn-3d min-h-[44px] py-3 px-4 font-display font-bold text-xs flex items-center justify-center gap-2 ${
                      !commander || cloudBusy || browserOffline
                        ? 'sl-btn-3d-slate opacity-50 cursor-not-allowed'
                        : 'sl-btn-3d-emerald cursor-pointer'
                    }`}
                  >
                    <CloudUpload className="w-4 h-4" />
                    Upload Local Save to Server
                  </button>
                  <button
                    type="button"
                    disabled={!commander || cloudBusy || browserOffline}
                    onClick={() => void handleDownloadCloudSave()}
                    className={`sl-btn-3d min-h-[44px] py-3 px-4 font-display font-bold text-xs flex items-center justify-center gap-2 ${
                      !commander || cloudBusy || browserOffline
                        ? 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                        : 'sl-btn-3d-cyan cursor-pointer'
                    }`}
                  >
                    <CloudDownload className="w-4 h-4" />
                    Download & Restore Cloud Save
                  </button>
                </div>

                {cloudConflict && (
                  <div className="mt-3 p-3.5 rounded-xl border border-amber-400/70 bg-amber-950/35 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Save Progress Conflict Detected (
                        {cloudConflict.direction === 'upload'
                          ? 'Cloud profile has higher progress'
                          : 'Local browser has higher progress'}
                        )
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="p-2.5 rounded-lg border border-slate-700 bg-slate-950/80">
                        <div className="text-[10px] uppercase text-slate-400 font-bold">Local Browser</div>
                        <div className="font-black text-white mt-0.5">
                          {cloudConflict.localScore} PTS · {cloudConflict.localWins}W
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-700 bg-slate-950/80">
                        <div className="text-[10px] uppercase text-slate-400 font-bold">Server Cloud</div>
                        <div className="font-black text-sky-300 mt-0.5">
                          {cloudConflict.cloudScore} PTS · {cloudConflict.cloudWins}W
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setCloudConflict(null)}
                        className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[38px] px-3 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void performUploadCloudSave()}
                        className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-emerald min-h-[38px] px-3 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        Keep & Upload Local
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDownloadedCloudSave(cloudConflict.cloudSave)}
                        className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan min-h-[38px] px-3 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        Load Server Cloud
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
