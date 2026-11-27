import { playCopy } from "../play/copy";
import { MoshState } from "../play/moshState";
import { playerOf, type FriendGame } from "../play/models";
import { gameName } from "./copy";
import { chatName, payloadOf, type ChatPerson, type Message } from "./models";

/** What a button of a game line does: takes the free seat of the game and then opens it, or just opens it. */
export type GameAction = { kind: "join" | "open"; gameId: string };

/**
 * What a game line of a chat draws, worked out from the message, the game it names (when the page knows it) and who I am (Messages/ChatGameLine.swift): the
 * مشاعره card of the board, an invitation or the line of a رودررو (a sentence and, when there is something to do, a button), or a line without a button (a game
 * that ended, a challenge's result).
 */
export type GameLine =
  | { kind: "mosh"; state: MoshState; gameId: string }
  | { kind: "invite"; text: string; button?: { title: string; action: GameAction } }
  | { kind: "line"; text: string };

const outcome = (by: string | undefined, myId: string | undefined, name: string): string => playCopy.title(by === undefined ? "draw" : by === myId ? "won" : "lost", name);

/** The line a message draws; undefined for a message that is not a game line this app draws. `me` is my username and `myId` my user id (the `by` of a game that ended is the winner's id). */
export function gameLine(message: Message, other: ChatPerson, game: FriendGame | undefined, me: string | undefined, myId: string | undefined): GameLine | undefined {
  const payload = payloadOf(message);
  if (!payload) return undefined;
  const name = chatName(other);
  if (message.kind === "game" && payload.event === "game_invite") {
    const id = payload.gameId ?? game?.id ?? "";
    const named = gameName(payload.kind);
    const waiting = game?.status !== "active" && game?.status !== "done";
    if (game && me && game.kind === "mosh" && !waiting) return { kind: "mosh", state: new MoshState(game, me), gameId: id };
    if (game?.kind === "duel" && game.status === "active") return { kind: "invite", text: `${named} با ${name} · الان در جریانه`, button: { title: "بزن بریم", action: { kind: "open", gameId: id } } };
    if (game?.status === "done") {
      const result = me && playerOf(game, me) ? new MoshState(game, me).outcomeTitle : undefined;
      return { kind: "invite", text: `${named} با ${name} · ${result ?? playCopy.title("draw", name)}` };
    }
    return message.fromMe
      ? { kind: "invite", text: playCopy.invited(named), button: { title: "ببین", action: { kind: "open", gameId: id } } }
      : { kind: "invite", text: playCopy.invite(name, named), button: { title: "بزن بریم", action: { kind: "join", gameId: id } } };
  }
  if (message.kind === "game" && payload.event === "challenge_result") {
    return { kind: "line", text: message.fromMe ? playCopy.challengeResultMine(name, payload.score ?? 0) : playCopy.challengeResult(name, payload.score ?? 0) };
  }
  if (message.kind === "system" && payload.event === "game_ended") return { kind: "line", text: `${gameName(payload.kind)} با ${name} تموم شد · ${outcome(payload.by, myId, name)}` };
  return undefined;
}
