import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";

/**
 * A screen: its sticky header, and the content in a centred column (560 at most) that keeps clear of the tab bar, which
 * is 88 high with the gap below it (a rail at the side from 1024 px, where nothing is below).
 */
export function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <main className="mx-auto max-w-[560px] px-[18px] pt-2 pb-[calc(88px+env(safe-area-inset-bottom)+16px)] lg:pb-8">{children}</main>
    </>
  );
}
