import { GameOverPage } from "../../../../../components/games/GameOverPage";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GameOverPage kind="book" searchParams={searchParams} />;
}
