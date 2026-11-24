import React from 'react';
import { motion } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Settings,
  Wrench,
  Trophy,
  Layers,
  Swords,
  Award,
  Target,
  Globe,
  AlertTriangle,
  MapPin,
  HelpCircle,
  ShieldAlert,
  Flame,
  Users,
  ChevronRight,
} from 'lucide-react';
import { ARENAS, ELEMENTS, SECRETS_CATALOG, getTopDefinition } from '../domain/catalog';
import { OwnedTopState, PlayerSaveData } from '../domain/types';
import { CommanderAvatar } from './CommanderAvatar';
import { LobbyBannerId, ModeBannerArtwork } from './ModeBannerArtwork';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleOverlayProps {
  save: PlayerSaveData;
  activeTop: OwnedTopState;
  unclaimedMissionsCount: number;
  storageWarning?: string | null;
  webglWarning?: string | null;
  onStartQuickBattle: () => void;
  onOpenTraining: () => void;
  onOpenTournament: () => void;
  onOpenSurvival?: () => void;
  onOpenBoss?: () => void;
  onOpenTeamBattle?: () => void;
  onOpenWorkshop: () => void;
  onOpenCollection: () => void;
  onOpenMissions: () => void;
  onOpenOnlineArena: () => void;
  onOpenCharacterCreator: () => void;
  onOpenLeaderboard: () => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  activeTop,
  unclaimedMissionsCount,
  storageWarning,
  webglWarning,
  onStartQuickBattle,
  onOpenTraining,
  onOpenTournament,
  onOpenSurvival,
  onOpenBoss,
  onOpenTeamBattle,
  onOpenWorkshop,
  onOpenCollection,
  onOpenMissions,
  onOpenOnlineArena,
  onOpenCharacterCreator,
  onOpenLeaderboard,
  onOpenHowToPlay,
  onOpenSettings,
  onToggleMute,
}) => {
  const topDef = getTopDefinition(activeTop.definitionId);
  const elemDef = ELEMENTS[topDef.element];
  const secElemDef = activeTop.secondaryElement ? ELEMENTS[activeTop.secondaryElement] : null;
  const arenaDef = ARENAS[save.selectedArenaId];

  const modeBanners: {
    id: Exclude<LobbyBannerId, 'enter-arena'>;
    label: string;
    sublabel: string;
    accentColor: string;
    icon: React.ReactNode;
    onClick: () => void;
  }[] = [
    {
      id: 'tournament',
      label: 'Tournament',
      sublabel: 'Bracket Cup',
      accentColor: '#fbbf24',
      icon: <Trophy className="w-4 h-4 text-amber-400 shrink-0" />,
      onClick: onOpenTournament,
    },
    {
      id: 'survival',
      label: 'Survival',
      sublabel: 'Endless Wave',
      accentColor: '#34d399',
      icon: <Flame className="w-4 h-4 text-emerald-400 shrink-0" />,
      onClick: onOpenSurvival ?? onOpenTournament,
    },
    {
      id: 'boss',
      label: 'Boss Raid',
      sublabel: 'Apex Duel',
      accentColor: '#fb7185',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />,
      onClick: onOpenBoss ?? onOpenTournament,
    },
    {
      id: 'team',
      label: '3v1 Tag Team',
      sublabel: 'Squad Relay',
      accentColor: '#c084fc',
      icon: <Users className="w-4 h-4 text-purple-400 shrink-0" />,
      onClick: onOpenTeamBattle ?? onOpenTournament,
    },
    {
      id: 'modes',
      label: 'Modes & Training',
      sublabel: 'Practice Lab',
      accentColor: '#38bdf8',
      icon: <Swords className="w-4 h-4 text-sky-400 shrink-0" />,
      onClick: onOpenTraining,
    },
    {
      id: 'online',
      label: 'Online Arena',
      sublabel: 'Ranked PvP',
      accentColor: '#22d3ee',
      icon: <Globe className="w-4 h-4 text-cyan-300 shrink-0" />,
      onClick: onOpenOnlineArena,
    },
  ];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-6 md:p-7 sl-safe-inset">
      {/* Centered Holographic Targeting Radar framing the 3D Spinning Showcase Top */}
      <div
        className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <div className="relative w-[min(64vw,520px)] h-[min(64vw,520px)] max-h-[68dvh] aspect-square flex items-center justify-center opacity-75">
          <svg
            viewBox="0 0 320 320"
            className={`w-full h-full ${save.settings.reducedMotion ? '' : 'sl-crest-spin'}`}
            style={{ animationDuration: '44s' }}
          >
            <circle
              cx="160"
              cy="160"
              r="148"
              fill="none"
              stroke={elemDef.primaryColor}
              strokeOpacity="0.22"
              strokeWidth="1.2"
              strokeDasharray="14 8 4 8"
            />
            <circle
              cx="160"
              cy="160"
              r="128"
              fill="none"
              stroke="#38bdf8"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeDasharray="3 9"
            />
            <path d="M 160 4 L 160 22 M 160 298 L 160 316 M 4 160 L 22 160 M 298 160 L 316 160" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.6" />
          </svg>
          <svg
            viewBox="0 0 320 320"
            className={`absolute inset-0 w-full h-full ${save.settings.reducedMotion ? '' : 'sl-crest-spin'}`}
            style={{ animationDuration: '28s', animationDirection: 'reverse' }}
          >
            <circle
              cx="160"
              cy="160"
              r="110"
              fill="none"
              stroke={elemDef.primaryColor}
              strokeOpacity="0.28"
              strokeWidth="1.4"
              strokeDasharray="24 44"
            />
            <circle
              cx="160"
              cy="160"
              r="88"
              fill="none"
              stroke="#94a3b8"
              strokeOpacity="0.16"
              strokeWidth="1"
              strokeDasharray="6 10"
            />
          </svg>
        </div>
      </div>

      {/* Top Perimeter Console: Smoked-Glass Currencies, Score, PWA Install & Guide/Mute/Settings */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 sl-ls-title-topbar flex items-start justify-between gap-2 sm:gap-3 flex-wrap"
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="sl-panel-chassis sl-ls-title-pill flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-lg min-h-[40px]">
            <span className="text-xs uppercase tracking-widest text-sky-300 font-bold font-display">
              Lv.{save.playerLevel}
            </span>
            <span className="h-3.5 w-px bg-slate-600/70" />
            <span className="text-sm font-bold text-amber-300 font-mono-tech tabular-nums">
              {save.currencies.gold}{' '}
              <span className="text-[10px] text-amber-200/70 font-sans font-bold tracking-wider">GOLD</span>
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-sm font-bold text-emerald-300 font-mono-tech tabular-nums">
              {save.currencies.energyCrystals}{' '}
              <span className="text-[10px] text-emerald-200/70 font-sans font-bold tracking-wider">CRYS</span>
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-sm font-bold text-purple-300 font-mono-tech tabular-nums">
              {save.currencies.legendaryFragments}{' '}
              <span className="text-[10px] text-purple-200/70 font-sans font-bold tracking-wider">FRAG</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-pill min-h-[40px] flex items-center gap-2 px-3.5 py-1.5 cursor-pointer whitespace-nowrap shrink-0"
            style={{ borderColor: 'rgba(245, 158, 11, 0.42)' }}
          >
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-bold text-white tabular-nums font-display">
              {save.playerScore} <span className="text-[10px] text-amber-300 font-bold">PTS</span>
            </span>
            <span className="text-[11px] text-slate-300 font-semibold hidden lg:inline">
              · {save.discoveredSecrets.length}/{SECRETS_CATALOG.length} Secrets
            </span>
          </button>

          <PWAInstallButton />
        </div>

        <div className="pointer-events-auto flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onOpenHowToPlay}
            aria-label="How to Play"
            title="How to Play"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-keycap min-h-[40px] min-w-[40px] px-3 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-xs font-bold hidden md:inline">Guide</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={save.settings.muted ? 'Unmute audio' : 'Mute audio'}
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-keycap min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer shrink-0"
          >
            {save.settings.muted ? (
              <VolumeX className="w-4 h-4 text-rose-300" />
            ) : (
              <Volume2 className="w-4 h-4 text-sky-300" />
            )}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSettings();
            }}
            aria-label="Open settings"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-keycap min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer shrink-0"
          >
            <Settings className="w-4 h-4 text-slate-200" />
          </button>
        </div>
      </motion.div>

      {/* Fallback Warnings (Storage / WebGL Context) */}
      {(storageWarning || webglWarning) && (
        <div className="relative z-10 pointer-events-auto max-w-lg space-y-1 my-1">
          {webglWarning && (
            <div className="px-3 py-1.5 rounded-lg border border-rose-500/60 bg-rose-950/92 text-rose-200 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{webglWarning}</span>
            </div>
          )}
          {storageWarning && (
            <div className="px-3 py-1.5 rounded-lg border border-amber-500/60 bg-amber-950/92 text-amber-200 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{storageWarning}</span>
            </div>
          )}
        </div>
      )}

      {/* Main 3-Zone Holographic Command Deck: Left Utility Dock + Center Open 3D Stage + Right Skewed Banners */}
      <div className="relative z-10 sl-lobby-deck flex-1 min-h-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-start sm:justify-between gap-2.5 sm:gap-3 pt-2 overflow-y-auto sm:overflow-visible">
        {/* Left Dock: Brand Lockup + Compact Hangar & Utility Tiles + Missions/Commander Footer Row */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
          className="sl-ls-lobby-left mt-auto sm:mt-0 pointer-events-auto w-full sm:max-w-[290px] md:max-w-[308px] flex flex-col gap-2 sm:self-center"
        >
          {/* Machined 3-Blade Turbine Crest & Metallic Wordmark */}
          <div className="sl-ls-title-lockup flex items-center gap-2.5 mb-1 drop-shadow-[0_10px_28px_rgba(0,0,0,0.92)]">
            <svg
              viewBox="0 0 100 100"
              className="sl-ls-title-crest w-[62px] h-[62px] sm:w-[76px] sm:h-[76px] shrink-0"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="slCrestMetal" x1="0" y1="0" x2="0.2" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="52%" stopColor="#cbd5e1" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
                <linearGradient id="slCrestBezel" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor={elemDef.primaryColor} />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="46" fill="#050914" stroke="#334155" strokeWidth="2.5" />
              <circle cx="50" cy="50" r="42" fill="#070d1e" stroke="url(#slCrestBezel)" strokeWidth="2.6" />
              <circle
                cx="50"
                cy="50"
                r="32"
                fill="none"
                stroke={elemDef.primaryColor}
                strokeOpacity="0.85"
                strokeWidth="1.6"
                strokeDasharray="11 5 3 5"
                className={save.settings.reducedMotion ? undefined : 'sl-crest-spin'}
              />
              <g
                className={save.settings.reducedMotion ? undefined : 'sl-crest-spin'}
                style={{ animationDuration: '26s', animationDirection: 'reverse' }}
              >
                <g transform="translate(50, 50)">
                  <path d="M 0,-36 L 11,-11 L 4,-4 L -4,-13 Z" fill="url(#slCrestMetal)" />
                  <path transform="rotate(120)" d="M 0,-36 L 11,-11 L 4,-4 L -4,-13 Z" fill="url(#slCrestMetal)" />
                  <path transform="rotate(240)" d="M 0,-36 L 11,-11 L 4,-4 L -4,-13 Z" fill="url(#slCrestMetal)" />
                </g>
              </g>
              <circle cx="50" cy="50" r="11" fill="#0f172a" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx="50" cy="50" r="5.5" fill={elemDef.primaryColor} />
            </svg>

            <svg
              viewBox="0 0 304 98"
              className="sl-ls-title-wordmark flex-1 min-w-0 h-auto"
              aria-label="Spin Legends"
            >
              <defs>
                <linearGradient id="slMetal" x1="0" y1="0" x2="0.2" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="52%" stopColor="#cbd5e1" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
                <linearGradient id="slAccent" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="58%" stopColor="#a5f3fc" />
                  <stop offset="100%" stopColor={elemDef.primaryColor} />
                </linearGradient>
              </defs>
              <text
                x="2"
                y="42"
                fill="url(#slMetal)"
                fontSize="43"
                fontWeight="700"
                fontStyle="italic"
                letterSpacing="3"
                fontFamily="Chakra Petch, Exo 2, sans-serif"
              >
                SPIN
              </text>
              <text
                x="4"
                y="80"
                fill="url(#slAccent)"
                fontSize="30"
                fontWeight="700"
                letterSpacing="6.5"
                fontFamily="Chakra Petch, Exo 2, sans-serif"
              >
                LEGENDS
              </text>
              <rect x="4" y="91" width="268" height="3" rx="1.5" fill="url(#slAccent)" opacity="0.92" />
              <rect x="4" y="91" width="76" height="3" rx="1.5" fill="#ffffff" opacity="0.7" />
            </svg>
          </div>

          {/* Mobile/Compact Active Telemetry Plate (shown when center bottom plate is hidden on small widths) */}
          <div
            className="md:hidden sl-panel-chassis sl-ls-title-telemetry px-3 py-2 rounded-lg flex items-center justify-between gap-2 relative overflow-hidden"
            style={{
              borderTop: `2px solid ${elemDef.primaryColor}`,
              backgroundImage: `radial-gradient(circle at 90% 20%, ${elemDef.primaryColor}20 0%, transparent 60%)`,
            }}
          >
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-white truncate flex items-center gap-1.5">
                {topDef.displayName}
                {activeTop.evolutionStage > 0 && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/50 font-mono-tech font-bold">
                    APEX
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-300 font-semibold truncate flex items-center gap-1">
                <span style={{ color: elemDef.primaryColor }}>{elemDef.displayName}</span>
                <span>·</span>
                <span className="font-mono-tech tabular-nums">Lv.{activeTop.level}</span>
              </div>
            </div>
            <div className="text-[10px] text-right font-mono-tech text-slate-300 shrink-0 tabular-nums">
              {activeTop.wins}W-{activeTop.losses}L
            </div>
          </div>

          {/* Compact Utility Grid: Hangar, Garage, Chronicle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenWorkshop}
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-tile min-h-[44px] py-2 px-3 text-xs font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              style={{ borderTop: '2px solid rgba(251, 146, 60, 0.72)' }}
            >
              <Wrench className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="truncate">Workshop</span>
            </button>
            <button
              type="button"
              onClick={onOpenCollection}
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-tile min-h-[44px] py-2 px-3 text-xs font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              style={{ borderTop: '2px solid rgba(52, 211, 153, 0.65)' }}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Garage ({save.ownedTops.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-tile w-full min-h-[40px] py-2 px-3 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Chronicle &amp; Rankings</span>
          </button>

          {/* Missions & Commander 2-Column Footer Row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenMissions}
              aria-label="Open missions and achievements"
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-tile min-h-[42px] py-2 px-2.5 text-xs font-semibold text-slate-100 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Missions</span>
              {unclaimedMissionsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black leading-none tabular-nums shrink-0">
                  {unclaimedMissionsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenCharacterCreator}
              aria-label="Open character creator"
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-title-tile min-h-[42px] py-1.5 px-2.5 text-xs font-semibold text-sky-100 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <CommanderAvatar appearance={save.character.appearance} size={20} />
              <span className="truncate">
                {save.character.created ? save.character.name : 'Commander'}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Center Bottom Active Top Telemetry Plate (Desktop/Tablet, leaving center 3D top unobstructed) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="hidden md:flex pointer-events-auto self-end sl-panel-chassis px-4 py-2.5 rounded-xl items-center gap-4 border border-slate-700/80 shadow-2xl"
          style={{
            borderTop: `2px solid ${elemDef.primaryColor}`,
            backgroundImage: `radial-gradient(circle at 50% 0%, ${elemDef.primaryColor}1d 0%, transparent 70%)`,
          }}
        >
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
              <span>{save.character.name}</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: arenaDef.primaryColor }}>
                <MapPin className="w-3 h-3 shrink-0" /> {arenaDef.displayName}
              </span>
            </div>
            <div className="font-display text-base font-bold text-white flex items-center gap-2 truncate mt-0.5">
              {topDef.displayName}
              {activeTop.evolutionStage > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/50 font-mono-tech font-bold">
                  APEX
                </span>
              )}
            </div>
          </div>
          <span className="h-7 w-px bg-slate-700/80" />
          <div className="text-right shrink-0">
            <div
              className="text-xs font-extrabold tracking-wide uppercase font-display"
              style={{ color: elemDef.primaryColor }}
            >
              {elemDef.displayName}
              {secElemDef ? (
                <span style={{ color: secElemDef.primaryColor }}> + {secElemDef.id}</span>
              ) : null}
            </div>
            <div className="text-[11px] text-slate-300 font-semibold font-mono-tech tabular-nums">
              Lv.{activeTop.level} · {activeTop.wins}W-{activeTop.losses}L
            </div>
          </div>
        </motion.div>

        {/* Right Diagonal Skewed Mode Banners */}
        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.34, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="sl-ls-lobby-right pointer-events-auto w-full max-w-[260px] sm:max-w-[300px] flex flex-col gap-2 self-end sm:self-center"
        >
          {/* Primary Skewed Enter Arena CTA */}
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartQuickBattle();
            }}
            className="sl-skew-banner sl-btn-3d-cyan sl-ls-title-cta w-full min-h-[54px] py-3 px-6 rounded-md font-display font-bold italic text-base sm:text-lg tracking-widest flex items-center justify-between gap-2 cursor-pointer whitespace-nowrap shadow-[0_10px_28px_rgba(14,165,233,0.34)]"
          >
            <ModeBannerArtwork id="enter-arena" accentColor="#38bdf8" elementColor={elemDef.primaryColor} />
            <span className="relative z-10 flex items-center gap-2.5">
              <Swords className="w-5 h-5 shrink-0" />
              <span>ENTER ARENA</span>
            </span>
            <ChevronRight className="relative z-10 w-5 h-5 shrink-0 opacity-85" />
          </button>

          {/* Secondary Mode Banners */}
          {modeBanners.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={b.onClick}
              className="sl-skew-banner sl-btn-3d-slate sl-ls-title-banner w-full min-h-[42px] py-2 px-4 rounded-md flex items-center justify-between gap-2 cursor-pointer whitespace-nowrap"
              style={{
                borderRight: `4px solid ${b.accentColor}`,
              }}
            >
              <ModeBannerArtwork id={b.id} accentColor={b.accentColor} />
              <span className="relative z-10 flex items-center gap-2 min-w-0">
                {b.icon}
                <span className="font-display font-bold text-xs sm:text-sm text-white truncate drop-shadow-[0_1px_4px_rgba(2,6,23,0.9)]">
                  {b.label}
                </span>
              </span>
              <span className="relative z-10 hidden sm:inline px-1.5 py-0.5 rounded bg-slate-950/75 border border-white/15 text-[10px] font-mono-tech uppercase tracking-wider text-slate-200 shrink-0">
                {b.sublabel}
              </span>
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
