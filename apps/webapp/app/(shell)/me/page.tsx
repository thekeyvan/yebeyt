import type { Metadata } from "next";
import { AccountCard } from "../../../components/account/AccountCard";
import { Page } from "../../../components/shell/Page";

export const metadata: Metadata = { title: "من" };

export default function MePage() {
  return (
    <Page title="من">
      <AccountCard />
    </Page>
  );
}
