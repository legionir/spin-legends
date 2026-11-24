import React from 'react';
import { ELEMENTS } from '../domain/catalog';
import { BattleMode, CharacterAppearance, ElementType } from '../domain/types';
import { CommanderAvatar } from './CommanderAvatar';

interface TopWingEmblemBadgeProps {
  side: 'player' | 'opponent';
  element: ElementType;
  secondaryElement?: ElementType | null;
  playerAppearance?: CharacterAppearance;
  opponentMode?: BattleMode;
  isCritical?: boolean;
}

const MODE_SHORT_TAG: Record<BattleMode, string> = {
  Attack: 'ATK',
  Defense: 'DEF',
  Speed: 'SPD',
  Stamina: 'STA',
  Berserk: 'BSK',
  Counter: 'CTR',
};

function renderTopSilhouette(
  element: ElementType,
  primary: string,
  secondary: string | null,
  isCritical: boolean,
  uid: string
) {
  const rimStroke = isCritical ? '#fb7185' : primary;
  const coreFill = secondary ?? '#e2e8f0';

  return (
    <g>
      <defs>
        <radialGradient id={`slTopGlow-${uid}`} cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor={rimStroke} stopOpacity="0.42" />
          <stop offset="65%" stopColor={rimStroke} stopOpacity="0.12" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`slTopMetal-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="48%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r="22" fill={`url(#slTopGlow-${uid})`} />

      {/* Outer stylized element blade geometry */}
      {element === 'Fire' && (
        <g>
          {[0, 120, 240].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 32 32)`}
              d="M32 10 C40 13, 47 21, 45 29 C40 24, 35 23, 31 27 L25 18 C27 14, 29 11, 32 10 Z"
              fill={rimStroke}
              stroke="#fef3c7"
              strokeOpacity="0.7"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}
      {element === 'Lightning' && (
        <g>
          {[0, 90, 180, 270].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 32 32)`}
              d="M32 9 L41 18 L36 22 L43 28 L33 27 L27 19 L32 16 Z"
              fill={rimStroke}
              stroke="#e0f2fe"
              strokeOpacity="0.8"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}
      {element === 'Water' && (
        <g>
          {[0, 120, 240].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 32 32)`}
              d="M32 10 C45 12, 52 24, 46 35 C41 30, 39 25, 33 24 C29 24, 25 22, 24 16 C26 12, 29 10, 32 10 Z"
              fill={rimStroke}
              stroke="#cffafe"
              strokeOpacity="0.72"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}
      {element === 'Wind' && (
        <g>
          {[0, 90, 180, 270].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 32 32)`}
              d="M32 9 C42 11, 48 18, 46 25 L35 25 C34 21, 31 18, 26 17 C27 12, 29 9, 32 9 Z"
              fill={rimStroke}
              stroke="#ecfdf5"
              strokeOpacity="0.72"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}
      {element === 'Earth' && (
        <g>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 32 32)`}
              d="M26 12 L38 12 L42 19 L36 24 L28 24 L22 19 Z"
              fill={rimStroke}
              stroke="#fde68a"
              strokeOpacity="0.65"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}
      {element === 'Shadow' && (
        <g>
          {[0, 180].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 32 32)`}
              d="M22 13 C33 8, 49 14, 51 28 C44 21, 35 19, 25 22 Z"
              fill={rimStroke}
              stroke="#e9d5ff"
              strokeOpacity="0.78"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}
      {element === 'Ice' && (
        <g>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 32 32)`}
              d="M32 9 L36 19 L32 24 L28 19 Z"
              fill={rimStroke}
              stroke="#e0f2fe"
              strokeOpacity="0.88"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}
      {element === 'Light' && (
        <g>
          {[0, 90, 180, 270].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 32 32)`}
              d="M32 8 L37 21 L44 24 L35 28 L29 28 L20 24 L27 21 Z"
              fill={rimStroke}
              stroke="#ffffff"
              strokeOpacity="0.85"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}

      {/* Brushed machined fusion wheel */}
      <circle
        cx="32"
        cy="32"
        r="12.5"
        fill="#0b1326"
        stroke={`url(#slTopMetal-${uid})`}
        strokeWidth="3.2"
      />
      {/* Secondary element orbital ring when dual-infused */}
      {secondary && (
        <circle
          cx="32"
          cy="32"
          r="9"
          fill="none"
          stroke={secondary}
          strokeWidth="1.6"
          strokeDasharray="6 3"
        />
      )}
      {/* Face bolt & spirit jewel */}
      <polygon
        points="32,24 38.9,28 38.9,36 32,40 25.1,36 25.1,28"
        fill="#0f172a"
        stroke="#e2e8f0"
        strokeOpacity="0.82"
        strokeWidth="1.1"
      />
      <circle cx="32" cy="32" r="3.4" fill={coreFill} stroke="#ffffff" strokeWidth="0.8" />
    </g>
  );
}

export const TopWingEmblemBadge: React.FC<TopWingEmblemBadgeProps> = ({
  side,
  element,
  secondaryElement,
  playerAppearance,
  opponentMode,
  isCritical = false,
}) => {
  const elemDef = ELEMENTS[element];
  const secElemDef = secondaryElement ? ELEMENTS[secondaryElement] : null;
  const uid = `${side}-${element}`;
  const accent = isCritical ? '#fb7185' : elemDef.primaryColor;
  const tiltDeg = side === 'player' ? -10 : 10;

  return (
    <div
      className="sl-ls-hud-crest-full hidden sm:flex relative shrink-0 w-12 h-12 md:w-[54px] md:h-[54px] items-center justify-center select-none pointer-events-none"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full drop-shadow-[0_4px_10px_rgba(2,6,23,0.9)]"
      >
        <defs>
          <linearGradient id={`slHexFrame-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.92" />
            <stop offset="35%" stopColor={accent} stopOpacity="0.95" />
            <stop offset="100%" stopColor={side === 'player' ? '#0284c7' : '#be123c'} stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={`slHexWell-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16223d" />
            <stop offset="55%" stopColor="#091022" />
            <stop offset="100%" stopColor="#040814" />
          </linearGradient>
        </defs>

        {/* Outer metallic hex frame */}
        <polygon
          points="32,2 58,17 58,47 32,62 6,47 6,17"
          fill={`url(#slHexWell-${uid})`}
          stroke={`url(#slHexFrame-${uid})`}
          strokeWidth="2.5"
        />
        {/* Inner beveled specular hex groove */}
        <polygon
          points="32,6.5 53.8,19 53.8,45 32,57.5 10.2,45 10.2,19"
          fill="none"
          stroke={accent}
          strokeOpacity="0.38"
          strokeWidth="1"
        />
        {/* Top bevel highlight accent */}
        <polyline
          points="10.5,19 32,6.5 53.5,19"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.45"
          strokeWidth="1.1"
        />

        {/* Dynamic tilted top silhouette */}
        <g transform={`rotate(${tiltDeg} 32 32)`}>
          {renderTopSilhouette(
            element,
            elemDef.primaryColor,
            secElemDef?.primaryColor ?? null,
            isCritical,
            uid
          )}
        </g>
      </svg>

      {/* Outer bottom-corner Commander portrait (Player) or Rival Stance Crest (Opponent) */}
      {side === 'player' && playerAppearance && (
        <div
          className="hidden md:flex absolute -bottom-1 -left-1 w-[22px] h-[22px] items-center justify-center sl-hud-hex-clip"
          style={{
            background: `linear-gradient(135deg, #e0f2fe 0%, ${accent} 100%)`,
            padding: '1.5px',
          }}
        >
          <div className="w-full h-full overflow-hidden sl-hud-hex-clip bg-slate-950 flex items-center justify-center">
            <CommanderAvatar appearance={playerAppearance} size={20} className="!rounded-none !border-0" />
          </div>
        </div>
      )}

      {side === 'opponent' && opponentMode && (
        <div
          className="hidden md:flex absolute -bottom-1 -right-1 px-1 py-0.5 rounded-sm border text-[7px] font-mono-tech font-black leading-none tracking-wider shadow-md"
          style={{
            backgroundColor: 'rgba(8, 12, 26, 0.96)',
            borderColor: `${accent}cc`,
            color: '#f8fafc',
          }}
        >
          {MODE_SHORT_TAG[opponentMode]}
        </div>
      )}
    </div>
  );
};

interface CompactHexTopEmblemProps {
  side: 'player' | 'opponent';
  element: ElementType;
  isCritical?: boolean;
}

export const CompactHexTopEmblem: React.FC<CompactHexTopEmblemProps> = ({
  side,
  element,
  isCritical = false,
}) => {
  const elemDef = ELEMENTS[element];
  const accent = isCritical ? '#fb7185' : elemDef.primaryColor;
  const uid = `cmp-${side}-${element}`;

  return (
    <svg
      viewBox="0 0 24 24"
      className="sl-ls-hud-crest-compact sm:hidden w-[18px] h-[18px] shrink-0"
      aria-hidden="true"
    >
      <polygon
        points="12,1.5 21,6.7 21,17.3 12,22.5 3,17.3 3,6.7"
        fill="#091022"
        stroke={accent}
        strokeWidth="1.6"
      />
      <g transform={`scale(0.35) translate(2.3 2.3)`}>
        {renderTopSilhouette(element, elemDef.primaryColor, null, isCritical, uid)}
      </g>
    </svg>
  );
};
