import { notFound } from "next/navigation";
import { parseLobby, isChallengeCode, isGameId } from "../../lib/play/routes";
import { GameLayer } from "../games/GameCover";
import { ChallengeAcceptScreen } from "./ChallengeAcceptScreen";
import { DuelScreen } from "./DuelScreen";
import { LobbyScreen } from "./LobbyScreen";
import { MoshScreen } from "./MoshScreen";

type Query = Record<string, string | string[] | undefined>;

// A game with a friend, or the board of a challenge, in front of the tabs: `modal` when it was opened inside the app (it rises over the page it came from), else by its link.

export function LobbyPage({ modal, query }: { modal: boolean; query: Query }) {
  const { game, friend } = parseLobby(query);
  return (
    <GameLayer modal={modal}>
      <LobbyScreen key={`${game} ${friend}`} start={{ game, friend: friend ? { username: friend, displayName: null, avatar: null } : undefined }} />
    </GameLayer>
  );
}

export function MoshPage({ modal, id }: { modal: boolean; id: string }) {
  if (!isGameId(id)) notFound();
  return (
    <GameLayer modal={modal}>
      <MoshScreen key={id} gameId={id} />
    </GameLayer>
  );
}

export function DuelPage({ modal, id }: { modal: boolean; id: string }) {
  if (!isGameId(id)) notFound();
  return (
    <GameLayer modal={modal}>
      <DuelScreen key={id} gameId={id} />
    </GameLayer>
  );
}

export function ChallengePage({ modal, code }: { modal: boolean; code: string }) {
  if (!isChallengeCode(code)) notFound();
  return (
    <GameLayer modal={modal}>
      <ChallengeAcceptScreen key={code} code={code} />
    </GameLayer>
  );
}
