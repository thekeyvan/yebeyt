import type { ReactNode } from "react";
import { Shell } from "../../components/shell/Shell";

/** `reader` is the slot a poem opened from inside the app fills (`@reader/(.)poem`), over the tab. */
export default function ShellLayout({ children, reader }: { children: ReactNode; reader: ReactNode }) {
  return <Shell reader={reader}>{children}</Shell>;
}
