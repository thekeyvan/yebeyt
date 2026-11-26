import type { Metadata } from "next";
import { GamesScreen } from "../../../components/games/GamesScreen";

export const metadata: Metadata = { title: "بازی" };

export default function GamesPage() {
  return <GamesScreen />;
}
