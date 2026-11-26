import type { Metadata } from "next";
import { RequestsScreen } from "../../../../components/friends/RequestsScreen";

export const metadata: Metadata = { title: "درخواست‌های دوستی" };

export default function Page() {
  return <RequestsScreen />;
}
