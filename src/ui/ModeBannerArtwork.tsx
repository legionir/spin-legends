import React from 'react';

export type LobbyBannerId =
  | 'enter-arena'
  | 'tournament'
  | 'survival'
  | 'boss'
  | 'team'
  | 'modes'
  | 'online';

interface ModeBannerArtworkProps {
  id: LobbyBannerId;
  accentColor: string;
  elementColor?: string;
}

export const ModeBannerArtwork: React.FC<ModeBannerArtworkProps> = ({
  id,
  accentColor,
  elementColor = '#38bdf8',
}) => {
  if (id === 'enter-arena') {
    return (
      <div
        className="sl-skew-art pointer-events-none absolute -inset-y-1 -inset-x-5 overflow-hidden"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 340 76"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="slEnterGlow" x1="38%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#083344" stopOpacity="0" />
              <stop offset="56%" stopColor="#082f49" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.82" />
            </linearGradient>
          </defs>
          {/* Right-side atmospheric depth backing so cyan CTA label stays crisp on left */}
          <rect x="0" y="0" width="340" height="76" fill="url(#slEnterGlow)" />

          {/* Stadium bowl perspective arcs */}
          <ellipse
            cx="268"
            cy="52"
            rx="92"
            ry="32"
            fill="none"
            stroke="#e0f2fe"
            strokeOpacity="0.34"
            strokeWidth="1.5"
          />
          <ellipse
            cx="268"
            cy="52"
            rx="62"
            ry="20"
            fill="none"
            stroke={elementColor}
            strokeOpacity="0.65"
            strokeWidth="1.8"
          />

          {/* Twin clashing energy speed arcs + top silhouettes */}
          <path
            d="M188 70 C216 32, 260 12, 326 8"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.48"
            strokeWidth="2.2"
          />
          <path
            d="M206 72 C232 42, 272 24, 330 22"
            fill="none"
            stroke={elementColor}
            strokeOpacity="0.72"
            strokeWidth="1.6"
          />

          {/* Stylized top disc & burst star at clash apex */}
          <g transform="translate(264 38) rotate(-14)">
            <ellipse cx="0" cy="0" rx="22" ry="9" fill="#0f172a" fillOpacity="0.78" stroke="#bae6fd" strokeWidth="1.4" />
            <ellipse cx="0" cy="0" rx="11" ry="4.4" fill={elementColor} fillOpacity="0.88" />
            <circle cx="0" cy="0" r="2.4" fill="#ffffff" />
          </g>
          <polygon
            points="238,34 242,24 246,34 256,37 246,40 242,50 238,40 228,37"
            fill="#ffffff"
            fillOpacity="0.85"
          />

          {/* Speed chevrons along outer right edge */}
          <path d="M294 12 L310 38 L294 64" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2.5" />
          <path d="M308 12 L324 38 L308 64" fill="none" stroke="#ffffff" strokeOpacity="0.42" strokeWidth="2.5" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="sl-skew-art pointer-events-none absolute -inset-y-1 -inset-x-5 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 340 58"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id={`slBannerScrim-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0b1120" stopOpacity="0.92" />
            <stop offset="52%" stopColor="#0f172a" stopOpacity="0.72" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.22" />
          </linearGradient>
        </defs>

        {id === 'tournament' && (
          <g>
            {/* Diagonal championship spotlight beams */}
            <polygon points="168,0 218,0 188,58 143,58" fill={accentColor} fillOpacity="0.14" />
            <polygon points="228,0 266,0 232,58 202,58" fill={accentColor} fillOpacity="0.18" />
            {/* Tournament bracket lines */}
            <path
              d="M150 15 H182 V29 H206 M150 43 H182 V29 M206 29 H232"
              fill="none"
              stroke={accentColor}
              strokeOpacity="0.62"
              strokeWidth="1.6"
            />
            <circle cx="182" cy="15" r="2.2" fill={accentColor} fillOpacity="0.78" />
            <circle cx="182" cy="43" r="2.2" fill={accentColor} fillOpacity="0.78" />
            <circle cx="206" cy="29" r="2.6" fill="#fef3c7" fillOpacity="0.88" />
            {/* Stylized Championship Trophy silhouette */}
            <g transform="translate(216 11)">
              <path
                d="M4 2 H28 L25 18 C24 24, 20 27, 16 27 C12 27, 8 24, 7 18 Z"
                fill={accentColor}
                fillOpacity="0.38"
                stroke={accentColor}
                strokeOpacity="0.82"
                strokeWidth="1.4"
              />
              <path d="M4 5 H-1 C-1 13, 3 16, 6 16 M28 5 H33 C33 13, 29 16, 26 16" fill="none" stroke={accentColor} strokeOpacity="0.72" strokeWidth="1.3" />
              <rect x="13" y="27" width="6" height="6" fill={accentColor} fillOpacity="0.56" />
              <rect x="8" y="33" width="16" height="3.5" rx="1" fill={accentColor} fillOpacity="0.82" />
            </g>
          </g>
        )}

        {id === 'survival' && (
          <g>
            {/* Endless wave concentric stadium shockwaves */}
            <circle cx="222" cy="30" r="46" fill="none" stroke={accentColor} strokeOpacity="0.28" strokeWidth="1.4" />
            <circle cx="222" cy="30" r="32" fill="none" stroke={accentColor} strokeOpacity="0.48" strokeWidth="1.6" strokeDasharray="10 5" />
            <circle cx="222" cy="30" r="18" fill="none" stroke="#a7f3d0" strokeOpacity="0.7" strokeWidth="1.5" />
            {/* Vortex ascending blade arcs */}
            <path
              d="M168 52 C192 28, 224 16, 272 10"
              fill="none"
              stroke={accentColor}
              strokeOpacity="0.56"
              strokeWidth="2"
            />
            <path
              d="M188 56 C208 38, 238 28, 282 24"
              fill="none"
              stroke="#a7f3d0"
              strokeOpacity="0.48"
              strokeWidth="1.4"
            />
            <polygon points="222,18 231,30 222,42 213,30" fill={accentColor} fillOpacity="0.44" stroke="#ecfdf5" strokeOpacity="0.75" strokeWidth="1.1" />
          </g>
        )}

        {id === 'boss' && (
          <g>
            {/* Hazard diagonal warning stripes on right margin */}
            {[290, 306, 322].map((x) => (
              <polygon
                key={x}
                points={`${x},0 ${x + 9},0 ${x - 12},58 ${x - 21},58`}
                fill={accentColor}
                fillOpacity="0.24"
              />
            ))}
            {/* Apex Boss hexagonal lock-on reticle */}
            <polygon
              points="218,8 238,19 238,41 218,52 198,41 198,19"
              fill={accentColor}
              fillOpacity="0.22"
              stroke={accentColor}
              strokeOpacity="0.82"
              strokeWidth="1.6"
            />
            <polygon
              points="218,16 230,23 230,37 218,44 206,37 206,23"
              fill="none"
              stroke="#fecdd3"
              strokeOpacity="0.65"
              strokeWidth="1.1"
            />
            {/* Twin crossed slash arcs */}
            <path d="M188 16 L248 44 M248 16 L188 44" stroke={accentColor} strokeOpacity="0.55" strokeWidth="1.6" />
          </g>
        )}

        {id === 'team' && (
          <g>
            {/* Overlapping triple-blade squad relay rings */}
            <circle cx="204" cy="31" r="14" fill={accentColor} fillOpacity="0.18" stroke={accentColor} strokeOpacity="0.62" strokeWidth="1.4" />
            <circle cx="228" cy="24" r="17" fill={accentColor} fillOpacity="0.22" stroke="#e9d5ff" strokeOpacity="0.72" strokeWidth="1.5" />
            <circle cx="252" cy="33" r="14" fill={accentColor} fillOpacity="0.18" stroke={accentColor} strokeOpacity="0.62" strokeWidth="1.4" />
            {/* Relay link path */}
            <path
              d="M168 40 L204 31 L228 24 L252 33 L286 22"
              fill="none"
              stroke="#e9d5ff"
              strokeOpacity="0.65"
              strokeWidth="1.4"
              strokeDasharray="4 3"
            />
            <circle cx="204" cy="31" r="3" fill={accentColor} />
            <circle cx="228" cy="24" r="3.6" fill="#f3e8ff" />
            <circle cx="252" cy="33" r="3" fill={accentColor} />
          </g>
        )}

        {id === 'modes' && (
          <g>
            {/* Blueprint tactical stadium grid */}
            <path
              d="M174 14 H334 M166 29 H334 M158 44 H334 M206 4 L188 56 M240 4 L222 56 M274 4 L256 56"
              fill="none"
              stroke={accentColor}
              strokeOpacity="0.26"
              strokeWidth="1"
            />
            {/* Launch trajectory parabola & target crosshairs */}
            <path
              d="M178 46 Q216 10, 248 29"
              fill="none"
              stroke="#bae6fd"
              strokeOpacity="0.82"
              strokeWidth="1.7"
              strokeDasharray="5 3"
            />
            <circle cx="248" cy="29" r="11" fill="none" stroke={accentColor} strokeOpacity="0.78" strokeWidth="1.5" />
            <path d="M248 14 V44 M233 29 H263" stroke={accentColor} strokeOpacity="0.72" strokeWidth="1.2" />
          </g>
        )}

        {id === 'online' && (
          <g>
            {/* Orbital ranked PvP globe wireframe + signal arcs */}
            <circle cx="226" cy="29" r="21" fill={accentColor} fillOpacity="0.16" stroke={accentColor} strokeOpacity="0.72" strokeWidth="1.5" />
            <ellipse cx="226" cy="29" rx="10" ry="21" fill="none" stroke={accentColor} strokeOpacity="0.52" strokeWidth="1.2" />
            <ellipse cx="226" cy="29" rx="21" ry="8" fill="none" stroke="#a5f3fc" strokeOpacity="0.55" strokeWidth="1.2" />
            {/* Signal wave arcs */}
            <path d="M188 20 A16 16 0 0 0 188 38" fill="none" stroke={accentColor} strokeOpacity="0.65" strokeWidth="1.6" />
            <path d="M178 14 A25 25 0 0 0 178 44" fill="none" stroke={accentColor} strokeOpacity="0.42" strokeWidth="1.4" />
            <circle cx="238" cy="22" r="2.8" fill="#ffffff" fillOpacity="0.95" />
          </g>
        )}

        {/* High-contrast directional readability scrim from left to right */}
        <rect x="0" y="0" width="340" height="58" fill={`url(#slBannerScrim-${id})`} />
      </svg>
    </div>
  );
};
