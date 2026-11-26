import type { Metadata } from "next";
import { RequestsRow } from "../../../components/friends/RequestsRow";
import { Page } from "../../../components/shell/Page";

export const metadata: Metadata = { title: "پیام‌ها" };

/** The chats come with the messages (W7); until then the requests row of friends is what the tab shows. */
export default function MessagesPage() {
  return (
    <Page title="پیام‌ها">
      <RequestsRow />
    </Page>
  );
}
