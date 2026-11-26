/** The header of a screen (`stickyHeader` in Design/Chrome.swift): the title, pinned to the top on the page's own dotted paper while the content scrolls under it. */
export function PageHeader({ title }: { title: string }) {
  return (
    <header className="dotted-paper sticky top-0 z-20 w-full px-[18px] pt-[calc(env(safe-area-inset-top)+6px)] pb-2">
      <h1 className="mx-auto max-w-[560px] text-[30px] text-ink">{title}</h1>
    </header>
  );
}
