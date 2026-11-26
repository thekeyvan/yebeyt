/** A slot's frame, in client coordinates. */
export type SlotFrame = { position: number; rect: Pick<DOMRect, "left" | "right" | "top" | "bottom"> };

/** The slot a held sticker was let go over, if any: the one whose frame, 8 px wider on every side, holds the point (`JigsawScreen.drop`). */
export function slotAt(point: { x: number; y: number }, frames: Iterable<SlotFrame>): number | undefined {
  for (const { position, rect } of frames) {
    if (point.x >= rect.left - 8 && point.x <= rect.right + 8 && point.y >= rect.top - 8 && point.y <= rect.bottom + 8) return position;
  }
  return undefined;
}
