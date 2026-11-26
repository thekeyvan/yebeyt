import type { ReactNode } from "react";

/**
 * A screen: its sticky header (`stickyHeader` in Design/Chrome.swift: pinned to the top on the page's own dotted paper while the content scrolls
 * under it), and the content in a centred column (560 at most) that keeps clear of the tab bar, which is 88 high with the gap below it (a rail at
 * the side from 1024 px, where nothing is below). A screen whose title scrolls with the content has no `header`.
 */
export function Screen({ header, children }: { header?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {header && (
        <header className="dotted-paper sticky top-0 z-20 w-full px-[18px] pt-[calc(env(safe-area-inset-top)+6px)] pb-2">
          <div className="mx-auto max-w-[560px]">{header}</div>
        </header>
      )}
      <main className={`mx-auto max-w-[560px] px-[18px] pb-[calc(88px+env(safe-area-inset-bottom)+16px)] lg:pb-8 ${header ? "pt-2" : "pt-[calc(env(safe-area-inset-top)+8px)]"}`}>
        {children}
      </main>
    </>
  );
}
