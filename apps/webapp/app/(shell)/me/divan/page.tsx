import type { Metadata } from "next";
import { DivanScreen } from "../../../../components/me/DivanScreen";

export const metadata: Metadata = { title: "دیوانِ من" };

export default function Page() {
  return <DivanScreen />;
}
