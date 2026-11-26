import type { ReactNode } from "react";

// The colours of the art that no part changes (packages/tokens/tokens.json has the named ones).
export const INK = "#14112B";
export const WHITE = "#FFFFFF";
export const GREEN = "#6CCB3A";
export const LAPIS = "#2F35F5";
export const MAGENTA = "#FF3D8B";
export const AMBER = "#FFB703";
export const FIRE = "#FF4D24";
export const PINK = "#FF8FB5";

type PathProps = { d: string; color: string; width?: number };
export const Fill = ({ d, color }: PathProps): ReactNode => <path d={d} fill={color} />;
export const Stroke = ({ d, color, width = 4 }: PathProps): ReactNode => <path d={d} fill="none" stroke={color} strokeWidth={width} />;
export const Dot = ({ x, y, r, color, opacity }: { x: number; y: number; r: number; color: string; opacity?: number }): ReactNode => (
  <circle cx={x} cy={y} r={r} fill={color} opacity={opacity} />
);
