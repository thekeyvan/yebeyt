import type { Metadata } from "next";
import { PrivacyScreen } from "../../../../components/me/PrivacyScreen";

export const metadata: Metadata = { title: "حریم خصوصی" };

export default function Page() {
  return <PrivacyScreen />;
}
