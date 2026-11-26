import type { Metadata } from "next";
import { ProfileScreen } from "../../../components/me/ProfileScreen";

export const metadata: Metadata = { title: "من" };

export default function Page() {
  return <ProfileScreen />;
}
