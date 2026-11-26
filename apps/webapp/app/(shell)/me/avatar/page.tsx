import type { Metadata } from "next";
import { AvatarScreen } from "../../../../components/me/AvatarScreen";

export const metadata: Metadata = { title: "چهره‌ی تو" };

export default function Page() {
  return <AvatarScreen />;
}
