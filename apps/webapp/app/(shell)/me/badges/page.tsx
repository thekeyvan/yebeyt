import type { Metadata } from "next";
import { BadgesScreen } from "../../../../components/me/BadgesScreen";

export const metadata: Metadata = { title: "نشان‌ها" };

export default function Page() {
  return <BadgesScreen />;
}
