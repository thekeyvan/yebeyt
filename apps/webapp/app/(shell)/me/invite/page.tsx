import type { Metadata } from "next";
import { InviteScreen } from "../../../../components/me/InviteScreen";

export const metadata: Metadata = { title: "دوستاتو بیار" };

export default function Page() {
  return <InviteScreen />;
}
