"use client";

/** Golden egg SVG with progressive crack stages (0 = intact). */
export function EggArt({ stage, className = "" }: { stage: number; className?: string }) {
  const crackStroke = "#5b3a0e";
  return (
    <svg viewBox="0 0 200 235" className={className} aria-hidden>
      <defs>
        <radialGradient id="goldBody" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="35%" stopColor="#f7c948" />
          <stop offset="75%" stopColor="#dd9a12" />
          <stop offset="100%" stopColor="#a96908" />
        </radialGradient>
        <linearGradient id="goldBand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe89a" />
          <stop offset="100%" stopColor="#e8a812" />
        </linearGradient>
        <filter id="eggGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="100" cy="222" rx="66" ry="9" fill="rgba(0,0,0,0.35)" />

      <g filter="url(#eggGlow)">
        <path
          d="M100 14 C143 14 171 72 171 122 C171 172 140 218 100 218 C60 218 29 172 29 122 C29 72 57 14 100 14 Z"
          fill="url(#goldBody)"
          stroke="#8a5f0a"
          strokeWidth="3"
        />
        {/* decorative band */}
        <path
          d="M33 138 C60 152 140 152 167 138"
          fill="none" stroke="url(#goldBand)" strokeWidth="10" strokeLinecap="round" opacity="0.7"
        />
        <circle cx="63" cy="58" r="7" fill="#fff7d6" opacity="0.85" />
        <ellipse cx="82" cy="44" rx="14" ry="7" fill="#ffffff" opacity="0.35" transform="rotate(-24 82 44)" />

        {/* crack stages — jagged dark seams with bright inner light */}
        {stage >= 1 && (
          <path
            d="M100 14 L92 34 L104 48 L94 66"
            fill="none" stroke={crackStroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
          />
        )}
        {stage >= 2 && (
          <path
            d="M94 66 L76 82 L88 96 L70 112 L84 128"
            fill="none" stroke={crackStroke} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"
          />
        )}
        {stage >= 3 && (
          <>
            <path
              d="M104 48 L126 62 L116 80 L138 96 L126 118"
              fill="none" stroke={crackStroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            />
            <path
              d="M116 80 L104 96 L112 110"
              fill="none" stroke="#fff1b8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"
            />
          </>
        )}
        {stage >= 4 && (
          <>
            <path
              d="M70 112 L50 128 L62 146 L44 160"
              fill="none" stroke={crackStroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            />
            <path
              d="M126 118 L146 132 L134 150 L152 162"
              fill="none" stroke={crackStroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            />
            <path
              d="M62 146 L86 156 M134 150 L110 160"
              stroke="#fff1b8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"
            />
          </>
        )}
      </g>

      {/* sparkles */}
      <g fill="#fff7d6">
        <path d="M158 44 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.6s" repeatCount="indefinite" />
        </path>
        <path d="M38 92 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 z" opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2.1s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
  );
}

/** Tiny confetti burst overlay. */
export function Confetti({ seedKey }: { seedKey: number }) {
  const pieces = Array.from({ length: 90 }, (_, i) => {
    const colors = ["#f7c948", "#d4f034", "#a78bfa", "#ff5c9d", "#4ade9c", "#ffffff"];
    return {
      left: (i * 37 + seedKey * 13) % 100,
      delay: ((i * 53) % 100) / 100,
      duration: 1.6 + ((i * 29) % 100) / 80,
      size: 6 + ((i * 17) % 8),
      color: colors[i % colors.length],
      round: i % 3 === 0,
    };
  });
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.5),
            background: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animation: `confetti-drop ${p.duration}s ${p.delay}s ease-in forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
