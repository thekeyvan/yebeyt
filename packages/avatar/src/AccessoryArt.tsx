import type { Accessory } from "./catalogue";
import { AMBER, Dot, FIRE, Fill, GREEN, MAGENTA, Stroke, WHITE } from "./shapes";

/**
 * An accessory in the grid's 44×44 box (AvatarArt.icon in AvatarView.swift). The crown, the helmet and the candle are also what the face wears or has
 * behind it: AvatarFace puts these same shapes on the head, scaled.
 */
export function AccessoryArt({ accessory }: { accessory: Accessory }) {
  switch (accessory) {
    case "none":
      return (
        <>
          <circle cx="22" cy="22" r="14" fill="none" stroke="#B9B4C6" strokeWidth="3" />
          <Stroke d="M12 32L32 12" color="#B9B4C6" width={3} />
        </>
      );
    case "ney":
      return (
        <g transform="rotate(35 22 22)">
          <rect x="18" y="2" width="8" height="40" rx="4" fill="#D9A86C" />
          {[14, 21, 28].map((y) => (
            <Dot key={y} x={22} y={y} r={1.6} color="#7A5230" />
          ))}
        </g>
      );
    case "rose":
      return (
        <>
          <Stroke d="M22 26v14" color="#4C9A22" width={3} />
          <Fill d="M22 34c-6-1-9-5-9-5 5-1 9 2 9 5z" color={GREEN} />
          <Dot x={22} y={17} r={10} color={MAGENTA} />
          <Stroke d="M16 17a6 6 0 0 1 12 0" color="#C21E62" width={2.2} />
          <Dot x={22} y={17} r={3} color="#C21E62" />
        </>
      );
    case "crown":
      return (
        <>
          <path d="M7 32L9 14l7 8 6-12 6 12 7-8 2 18z" fill={AMBER} stroke="#C98A00" strokeWidth="2" />
          <rect x="7" y="31" width="30" height="5" rx="2" fill="#C98A00" />
          <Dot x={22} y={25} r={2.5} color={FIRE} />
        </>
      );
    case "helmet":
      return (
        <>
          <Stroke d="M22 4v6" color="#6E7488" width={3} />
          <Fill d="M8 30a14 14 0 0 1 28 0z" color="#9AA0B4" />
          <rect x="6" y="29" width="32" height="5" rx="2.5" fill="#6E7488" />
          <Stroke d="M22 30v8" color="#6E7488" width={3} />
        </>
      );
    case "candle":
      return (
        <>
          <rect x="17" y="20" width="10" height="20" rx="3" fill={WHITE} stroke="#DAD6E2" strokeWidth="2" />
          <Fill d="M22 8c3 4 3 7 0 10-3-3-3-6 0-10z" color={AMBER} />
          <Fill d="M33 12c3-3 7-2 7 1s-4 3-7 0zM33 12c-1 4 1 7 3 6s1-5-3-6z" color={FIRE} />
        </>
      );
  }
}

/** The grid's icon of an accessory, `size` px wide. */
export function AccessoryIcon({ accessory, size = 44 }: { accessory: Accessory; size?: number }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
      <AccessoryArt accessory={accessory} />
    </svg>
  );
}
