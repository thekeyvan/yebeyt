"use client";

import { Dialog, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { addMark, clamp01, drawMarks, rectBetween, undoMark, type Mark, type Point } from "../../lib/feedback/markup";
import { Segmented } from "../ui/Segmented";
import { CapsuleButton, CloseButton } from "./controls";
import { useObjectUrl } from "./useObjectUrl";

type Tool = "line" | "cover";

const tools = [
  { value: "line", label: "خط بکش" },
  { value: "cover", label: "بپوشون" },
] as const;

/** The picture with the marks being drawn over it, in the picture's own pixels so they match what is sent, the tools, «برگردون» and the two ends («تمام», ×). */
function Editor({ image, done }: { image: Blob; done: (marks: Mark[]) => void }) {
  const url = useObjectUrl(image);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [tool, setTool] = useState<Tool>("line");
  const [live, setLive] = useState<Mark>();
  const [loaded, setLoaded] = useState(false);
  // What is being drawn, kept in a ref too: a move is not flushed to the screen before the finger lets go, and the end must see the last of it.
  const drawing = useRef<{ mark: Mark; from: Point }>(undefined);
  const picture = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const surface = canvas.current;
    const photo = picture.current;
    if (!surface || !photo || !loaded) return;
    surface.width = photo.naturalWidth;
    surface.height = photo.naturalHeight;
    drawMarks(surface.getContext("2d")!, live ? [...marks, live] : marks, surface.width, surface.height);
  }, [marks, live, loaded]);

  const at = (event: PointerEvent): Point => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: clamp01((event.clientX - box.left) / box.width), y: clamp01((event.clientY - box.top) / box.height) };
  };

  const down = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = at(event);
    drawing.current = { from: point, mark: tool === "line" ? { kind: "line", points: [point] } : { kind: "cover", rect: rectBetween(point, point) } };
    setLive(drawing.current.mark);
  };
  const move = (event: PointerEvent) => {
    const current = drawing.current;
    if (!current) return;
    const point = at(event);
    current.mark = current.mark.kind === "line" ? { kind: "line", points: [...current.mark.points, point] } : { kind: "cover", rect: rectBetween(current.from, point) };
    setLive(current.mark);
  };
  const up = () => {
    const current = drawing.current;
    drawing.current = undefined;
    if (current) setMarks((all) => addMark(all, current.mark));
    setLive(undefined);
  };

  return (
    <div className="mx-auto flex h-full max-w-[640px] flex-col gap-3.5 px-[18px] pt-[max(12px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2.5">
        <CloseButton onClick={() => done([])} testId="editor-close" />
        <DialogTitle className="flex-1 text-start font-title text-[22px] leading-[1.3] text-ink">خط بکش یا بپوشون</DialogTitle>
        <CapsuleButton onClick={() => done(marks)} testId="editor-done">
          تمام
        </CapsuleButton>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center">
        {url && (
          <div className="relative max-h-full max-w-full overflow-hidden rounded-[10px] shadow-[0_4px_8px_rgba(20,17,43,0.18)]">
            <img ref={picture} src={url} alt="" onLoad={() => setLoaded(true)} className="block max-h-[calc(100dvh-190px)] max-w-full select-none" draggable={false} />
            <canvas ref={canvas} data-testid="editor-picture" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="absolute inset-0 size-full touch-none cursor-crosshair" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <Segmented value={tool} onValueChange={setTool} options={tools} label="ابزار" look="divan" />
        </div>
        <button type="button" disabled={marks.length === 0} data-testid="editor-undo" onClick={() => setMarks(undoMark(marks))} className="rounded-full bg-white px-4 py-[11px] text-[13px] font-bold text-ink disabled:opacity-40">
          برگردون
        </button>
      </div>
    </div>
  );
}

/** «خط بکش یا بپوشون»: a full screen to draw ink lines or cover parts of the screenshot with solid ink before it is sent. «تمام» hands back the marks; × keeps the picture as it was. */
export function ScreenshotEditor({ open, image, done }: { open: boolean; image: Blob; done: (marks: Mark[]) => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && done([])}>
      <DialogContent className="fixed inset-0 z-[60] bg-board-paper outline-none">
        <Editor image={image} done={done} />
      </DialogContent>
    </Dialog>
  );
}
