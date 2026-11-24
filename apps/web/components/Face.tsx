/**
 * The default face of the Avatar board, in an amber sticker circle. The parts a person chose (the server's `avatar`) are not
 * drawn on the page yet: every link page shows this face, the one the app starts everyone with.
 */
export function Face({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "avatar large" : "avatar"} aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#FFE08A" />
        <path d="M0 150 C40 130 70 150 110 138 C150 126 175 142 200 132 L200 200 L0 200Z" fill="#9BE275" />
        <path d="M18 58c8-10 20-8 22 2-10 4-18 4-22-2z" fill="#6CCB3A" />
        <path d="M166 40c8-8 18-4 18 4-8 4-14 3-18-4z" fill="#6CCB3A" />
        <g transform="rotate(24 150 96)">
          <rect x="145" y="28" width="11" height="120" rx="5.5" fill="#D9A86C" />
          <circle cx="150.5" cy="60" r="2.2" fill="#7A5230" />
          <circle cx="150.5" cy="72" r="2.2" fill="#7A5230" />
          <circle cx="150.5" cy="84" r="2.2" fill="#7A5230" />
          <rect x="145" y="28" width="11" height="8" rx="3" fill="#B98448" />
        </g>
        <path d="M44 210 C48 170 76 158 100 158 C124 158 152 170 156 210Z" fill="#2F35F5" />
        <path d="M86 158 L100 176 L114 158Z" fill="#FFFFFF" />
        <circle cx="100" cy="108" r="52" fill="#F2C29B" />
        <path d="M47 104 C46 62 76 48 100 48 C126 48 154 62 153 104 C144 86 126 78 112 80 C104 72 90 70 80 74 C68 78 54 88 47 104Z" fill="#3B2A2A" />
        <path d="M74 98 q8 -5 16 0" fill="none" stroke="#3B2A2A" strokeWidth="4" strokeLinecap="round" />
        <path d="M110 98 q8 -5 16 0" fill="none" stroke="#3B2A2A" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="82" cy="112" rx="5.5" ry="6.5" fill="#14112B" />
        <ellipse cx="118" cy="112" rx="5.5" ry="6.5" fill="#14112B" />
        <circle cx="84" cy="110" r="1.8" fill="#FFFFFF" />
        <circle cx="120" cy="110" r="1.8" fill="#FFFFFF" />
        <circle cx="70" cy="128" r="7" fill="#FF8FB5" opacity="0.55" />
        <circle cx="130" cy="128" r="7" fill="#FF8FB5" opacity="0.55" />
        <path d="M88 134 Q100 146 112 134" fill="none" stroke="#14112B" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
