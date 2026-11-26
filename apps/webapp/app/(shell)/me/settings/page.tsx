import type { Metadata } from "next";
import { SettingsScreen } from "../../../../components/me/SettingsScreen";

export const metadata: Metadata = { title: "تنظیمات" };

export default function Page() {
  return <SettingsScreen />;
}
