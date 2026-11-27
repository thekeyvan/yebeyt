"use client";

import { Dialog, DialogBackdrop, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import { Drawer, DrawerBackdrop, DrawerContent, DrawerDescription, DrawerTitle } from "@ui-sdk/react/drawer";
import { motion } from "motion/react";
import type { ComponentType, ReactNode } from "react";
import { useMediaQuery } from "../../lib/media";
import { bouncy, menuArrival, useVariant } from "../../lib/motion";

type Part = ComponentType<{ className?: string; children?: ReactNode }>;

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description?: string;
  /** On the board paper instead of white: for a form of white fields (the feedback sheet). */
  paper?: boolean;
  children?: ReactNode;
} & (
  | { title: string; header?: undefined }
  /** Sets its own heading (an icon beside it, a button at its end) instead of the centred title; it must put the `Title` it is given in it, which names the dialog. */
  | { header: (Title: Part) => ReactNode; title?: undefined }
);

const backdrop = "fixed inset-0 z-40 bg-ink/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0";
const surface = (paper?: boolean) => `z-50 ${paper ? "bg-board-paper" : "bg-white"} px-[22px] text-ink outline-none`;

function Words({ Title, Description, title, header, description }: { Title: Part; Description: Part; title?: string; header?: (Title: Part) => ReactNode; description?: string }) {
  return (
    <>
      {header ? header(Title) : <Title className="text-center font-title text-2xl leading-[1.3]">{title}</Title>}
      {description && <Description className="text-center text-sm text-muted">{description}</Description>}
    </>
  );
}

/** From the bottom: a grabber, 30 corners, as tall as its content (and scrolling when that is more than fits). */
function BottomSheet({ open, onOpenChange, title, header, description, paper, children }: SheetProps) {
  return (
    // The pointer driver follows the finger and honours Reduce Motion (the scroll-snap one, which touch screens get by default, does not).
    <Drawer open={open} onOpenChange={onOpenChange} driver="pointer">
      <DrawerBackdrop className={backdrop} />
      <DrawerContent
        className={`${surface(paper)} relative mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col items-center gap-4 rounded-t-[30px] pt-3 pb-[max(16px,env(safe-area-inset-bottom))] after:absolute after:inset-x-0 after:top-full after:h-24 ${paper ? "after:bg-board-paper" : "after:bg-white"}`}
      >
        <div aria-hidden className="h-[5px] w-10 shrink-0 rounded-pill bg-ring" data-testid="grabber" />
        {/* Only this part scrolls (when the content is more than fits): the white strip under the sheet, for overscroll, is outside it. */}
        <div className="flex min-h-0 w-full flex-col items-center gap-4 overflow-y-auto">
          <Words Title={DrawerTitle} Description={DrawerDescription} title={title} header={header} description={description} />
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** In the middle of the screen from 768 px: the same content, growing from a little smaller. */
function CentredDialog({ open, onOpenChange, title, header, description, paper, children }: SheetProps) {
  const v = useVariant();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBackdrop className={backdrop} />
      <DialogContent
        className={`${surface(paper)} fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100%-2rem))] overflow-y-auto rounded-[30px] py-7 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0`}
      >
        <motion.div initial={menuArrival(v)} animate={{ scale: 1 }} transition={bouncy} className="flex flex-col items-center gap-4">
          <Words Title={DialogTitle} Description={DialogDescription} title={title} header={header} description={description} />
          {children}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A bottom sheet (Design/SheetStyle.swift): it rises from the bottom, follows a drag down and closes on that, on Escape
 * and on a tap on the dimmed page; focus is trapped inside and goes back to where it was. From 768 px it is a dialog in
 * the middle of the screen with the same content. Drag, focus and keys are UI SDK's drawer and dialog.
 */
export function Sheet(props: SheetProps) {
  const wide = useMediaQuery("(min-width: 768px)");
  return wide ? <CentredDialog {...props} /> : <BottomSheet {...props} />;
}
