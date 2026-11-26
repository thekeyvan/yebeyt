import type { Metadata } from "next";
import { FriendsScreen } from "../../../../components/friends/FriendsScreen";

export const metadata: Metadata = { title: "دوستا" };

export default function Page() {
  return <FriendsScreen />;
}
