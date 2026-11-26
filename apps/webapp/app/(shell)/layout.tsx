import type { ReactNode } from "react";
import { Shell } from "../../components/shell/Shell";

/** `reader` is the slot a poem opened from inside the app fills (`@reader/(.)poem`), over the tab; `game` the one a game fills (`@game/(.)games/…`), under the reader, which opens over it. */
export default function ShellLayout({ children, reader, game }: { children: ReactNode; reader: ReactNode; game: ReactNode }) {
  return (
    <Shell reader={reader} game={game}>
      {children}
    </Shell>
  );
}
