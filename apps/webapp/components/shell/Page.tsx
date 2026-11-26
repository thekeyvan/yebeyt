import type { ReactNode } from "react";
import { Screen } from "./Screen";

/** A tab's page with its title in the sticky header. */
export function Page({ title, children }: { title: string; children?: ReactNode }) {
  return <Screen header={<h1 className="text-[30px] text-ink">{title}</h1>}>{children}</Screen>;
}
