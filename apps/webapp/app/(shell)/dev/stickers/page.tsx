import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "../../../../components/shell/Page";
import { devPagesEnabled } from "../../../../lib/dev";
import { Playground } from "./Playground";

export const metadata: Metadata = { title: "برچسب‌ها" };

/** Every component of components/ui on one page, for looking at and for the end-to-end tests. Only while developing, or in a build made with NEXT_PUBLIC_DEV_PAGES=1. */
export default function StickersPage() {
  if (!devPagesEnabled()) notFound();
  return (
    <Page title="برچسب‌ها">
      <Playground />
    </Page>
  );
}
