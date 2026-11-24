import React from 'react';
import { CharacterAppearance } from '../domain/types';

interface CommanderAvatarProps {
  appearance: CharacterAppearance;
  size?: number;
  className?: string;
}

export const CommanderAvatar: React.FC<CommanderAvatarProps> = ({
  appearance,
  size = 56,
  className = '',
}) => {
  const { hairStyle, hairColor, outfitColor, accentColor } = appearance;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={`rounded-lg border border-slate-700/80 shrink-0 ${className}`}
      style={{ backgroundColor: '#0b1224' }}
      aria-hidden="true"
    >
      {/* Background radial glow */}
      <circle cx="48" cy="48" r="44" fill={accentColor} opacity="0.14" />
      <circle cx="48" cy="48" r="38" fill="none" stroke={accentColor} strokeWidth="1.5" opacity="0.35" />

      {/* Jacket / Outfit */}
      <path
        d="M16 96 C18 71, 30 64, 48 64 C66 64, 78 71, 80 96 Z"
        fill={outfitColor}
      />
      {/* Jacket Collar & Accent Trim */}
      <path d="M32 67 L48 82 L64 67" fill="none" stroke={accentColor} strokeWidth="3.5" strokeLinecap="round" />
      <rect x="44" y="80" width="8" height="16" fill={accentColor} opacity="0.85" />

      {/* Neck & Face */}
      <rect x="41" y="54" width="14" height="14" rx="4" fill="#f1c7a6" />
      <ellipse cx="48" cy="43" rx="17" ry="19" fill="#fbd7ba" />

      {/* Eyes */}
      <rect x="38" y="42" width="6" height="4" rx="1.5" fill="#0f172a" />
      <rect x="52" y="42" width="6" height="4" rx="1.5" fill="#0f172a" />
      <circle cx="40" cy="43.5" r="1" fill={accentColor} />
      <circle cx="54" cy="43.5" r="1" fill={accentColor} />

      {/* Hair Styles */}
      {hairStyle === 'spiky' && (
        <path
          d="M27 42 L22 25 L34 29 L38 14 L48 24 L58 13 L63 29 L74 24 L69 42 C66 31, 58 27, 48 27 C38 27, 30 31, 27 42 Z"
          fill={hairColor}
        />
      )}
      {hairStyle === 'sleek' && (
        <path
          d="M28 44 C26 24, 38 16, 52 17 C65 18, 72 28, 69 44 C64 33, 56 29, 43 31 C35 32, 31 37, 28 44 Z"
          fill={hairColor}
        />
      )}
      {hairStyle === 'braided' && (
        <g fill={hairColor}>
          <path d="M29 41 C29 24, 38 17, 48 17 C58 17, 67 24, 67 41 C61 30, 54 27, 48 27 C42 27, 35 30, 29 41 Z" />
          <path d="M27 36 L20 56 L27 56 L32 42 Z" />
          <path d="M69 36 L76 56 L69 56 L64 42 Z" />
        </g>
      )}
      {hairStyle === 'visor' && (
        <g>
          <path
            d="M29 38 C29 22, 38 17, 48 17 C58 17, 67 22, 67 38 C60 29, 54 27, 48 27 C42 27, 36 29, 29 38 Z"
            fill={hairColor}
          />
          <rect
            x="32"
            y="38"
            width="32"
            height="10"
            rx="4"
            fill="#0f172a"
            stroke={accentColor}
            strokeWidth="2"
          />
          <line x1="36" y1="43" x2="60" y2="43" stroke={accentColor} strokeWidth="2" opacity="0.9" />
        </g>
      )}
    </svg>
  );
};
