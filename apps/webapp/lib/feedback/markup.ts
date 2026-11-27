import { colors } from "../tokens";

/** The marks drawn on a screenshot in the editor: ink lines and solid ink rectangles. Positions are fractions of the picture (0…1), so the same marks fit the picture at any size. */
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Mark = { kind: "line"; points: Point[] } | { kind: "cover"; rect: Rect };

/** A line is as thick as 0.7% of the picture's long side. */
export const lineWidth = 0.007;

/** `marks` with one more; the list itself is never changed. */
export const addMark = (marks: readonly Mark[], mark: Mark): Mark[] => [...marks, mark];

/** `marks` without the last one (nothing left: no harm). */
export const undoMark = (marks: readonly Mark[]): Mark[] => marks.slice(0, -1);

export const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/** The rectangle between the point a drag began at and the one it is at. */
export const rectBetween = (from: Point, to: Point): Rect => ({ x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) });

/** Draws `marks` in ink over a picture of `width`×`height`: what the editor shows and what is sent. */
export function drawMarks(context: CanvasRenderingContext2D, marks: readonly Mark[], width: number, height: number): void {
  const thickness = lineWidth * Math.max(width, height);
  context.strokeStyle = colors.ink;
  context.fillStyle = colors.ink;
  context.lineWidth = thickness;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const mark of marks) {
    if (mark.kind === "cover") {
      const { x, y, width: w, height: h } = mark.rect;
      context.fillRect(x * width, y * height, w * width, h * height);
      continue;
    }
    const [first, ...rest] = mark.points;
    if (!first) continue;
    if (rest.length === 0) {
      context.beginPath();
      context.arc(first.x * width, first.y * height, thickness / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    context.moveTo(first.x * width, first.y * height);
    for (const point of rest) context.lineTo(point.x * width, point.y * height);
    context.stroke();
  }
}
