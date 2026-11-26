import { useId } from "react";
import { AccessoryArt } from "./AccessoryArt";
import { look, type Accessory, type AvatarParts } from "./catalogue";
import { Dot, Fill, GREEN, INK, LAPIS, MAGENTA, PINK, Stroke, WHITE } from "./shapes";

/** What stands behind the shoulders (the ney, the rose, the candle). */
function Behind({ accessory }: { accessory: Accessory }) {
  switch (accessory) {
    case "ney":
      return (
        <g transform="rotate(24 150 96)">
          <rect x="145" y="28" width="11" height="120" rx="5.5" fill="#D9A86C" />
          {[60, 72, 84].map((y) => (
            <Dot key={y} x={150.5} y={y} r={2.2} color="#7A5230" />
          ))}
          <rect x="145" y="28" width="11" height="8" rx="3" fill="#B98448" />
        </g>
      );
    case "rose":
      return (
        <>
          <Stroke d="M152 96 L152 176" color="#4C9A22" width={5} />
          <Fill d="M152 140 C140 138 134 130 134 130 C145 128 152 134 152 140Z" color={GREEN} />
          <Dot x={152} y={74} r={22} color={MAGENTA} />
          <Stroke d="M139 74 a13 13 0 0 1 26 0" color="#C21E62" />
          <Dot x={152} y={74} r={6.5} color="#C21E62" />
        </>
      );
    case "candle":
      return (
        <g transform="translate(84 42) scale(3)">
          <AccessoryArt accessory="candle" />
        </g>
      );
    default:
      return null;
  }
}

/** What sits on the head (the crown, the helmet): the grid's 44×44 icons, placed. */
function OnHead({ accessory }: { accessory: Accessory }) {
  switch (accessory) {
    case "crown":
      return (
        <g transform="translate(47 -24) scale(2.4)">
          <AccessoryArt accessory="crown" />
        </g>
      );
    case "helmet":
      return (
        <g transform="translate(29.6 -21) scale(3.2)">
          <AccessoryArt accessory="helmet" />
        </g>
      );
    default:
      return null;
  }
}

function Eyes({ id }: { id: string }) {
  const round = (x: number) => (
    <>
      <ellipse cx={x} cy="112" rx="5.5" ry="6.5" fill={INK} />
      <Dot x={x + 2} y={110} r={1.8} color={WHITE} />
    </>
  );
  const happy = (d: string) => <Stroke d={d} color={INK} />;
  const right = happy("M110 114 q8 -9 16 0");
  if (id === "happy") return <>{happy("M74 114 q8 -9 16 0")}{right}</>;
  if (id === "wink") return <>{round(82)}{right}</>;
  return <>{round(82)}{round(118)}</>;
}

function Mouth({ id }: { id: string }) {
  if (id === "grin") {
    return (
      <>
        <Fill d="M84 130 Q100 156 116 130Z" color={INK} />
        <Fill d="M92 141 Q100 148 108 141 Q100 138 92 141Z" color={PINK} />
      </>
    );
  }
  if (id === "calm") return <Stroke d="M90 138 Q100 142 110 138" color={INK} />;
  return <Stroke d="M88 134 Q100 146 112 134" color={INK} />;
}

/**
 * A face drawn from the parts the server keeps (`avatar`): the SVG of the app's AvatarView (apps/ios/Yebeyt/Me/Avatar/AvatarView.swift: a 200×200
 * box clipped to a circle, the same shapes in the same layers). The standard face for null; a part this page doesn't know is drawn as the app does
 * (`look`): its default, or no accessory. The circle, the ring and the size are the page's.
 */
export function AvatarFace({ avatar }: { avatar: AvatarParts | null }) {
  const clip = useId();
  const face = look(avatar);
  return (
    <svg viewBox="0 0 200 200">
      <clipPath id={clip}>
        <circle cx="100" cy="100" r="96" />
      </clipPath>
      <g clipPath={`url(#${clip})`} strokeLinecap="round" strokeLinejoin="round">
        <rect width="200" height="200" fill={face.background} />
        <Fill d="M0 150 C40 130 70 150 110 138 C150 126 175 142 200 132 L200 200 L0 200Z" color="#9BE275" />
        <Fill d="M18 58c8-10 20-8 22 2-10 4-18 4-22-2z" color={GREEN} />
        <Fill d="M166 40c8-8 18-4 18 4-8 4-14 3-18-4z" color={GREEN} />
        <Behind accessory={face.accessory} />
        <Fill d="M44 210 C48 170 76 158 100 158 C124 158 152 170 156 210Z" color={LAPIS} />
        <Fill d="M86 158 L100 176 L114 158Z" color={WHITE} />
        <Dot x={100} y={108} r={52} color={face.skin} />
        <Fill d="M47 104 C46 62 76 48 100 48 C126 48 154 62 153 104 C144 86 126 78 112 80 C104 72 90 70 80 74 C68 78 54 88 47 104Z" color={face.hair} />
        <Stroke d="M74 98 q8 -5 16 0" color={face.hair} />
        <Stroke d="M110 98 q8 -5 16 0" color={face.hair} />
        <Eyes id={face.eyes} />
        <Dot x={70} y={128} r={7} color={PINK} opacity={0.55} />
        <Dot x={130} y={128} r={7} color={PINK} opacity={0.55} />
        <Mouth id={face.mouth} />
        <OnHead accessory={face.accessory} />
      </g>
    </svg>
  );
}
