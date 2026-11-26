import type { ReactNode } from "react";

/** The spinner of a list that is loading (a `ProgressView`). */
export const Busy = () => (
  <div className="flex justify-center pt-6">
    <span role="status" aria-label="یه لحظه…" className="size-6 animate-spin rounded-full border-[3px] border-ring border-t-lapis motion-reduce:animate-none" />
  </div>
);

/** A line of muted text in the middle: why a list failed, or why it is empty. */
export const Note = ({ children, testId, top = "pt-6" }: { children: ReactNode; testId?: string; top?: string }) => (
  <p data-testid={testId} className={`${top} text-center text-sm text-muted`}>
    {children}
  </p>
);
