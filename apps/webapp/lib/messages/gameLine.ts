import { persianDigits } from "../persian";
import { gameName } from "./copy";
import { chatName, payloadOf, type ChatPerson, type Message } from "./models";

/** What a game line of a chat draws: a sentence and, when there is something to do, a button (Messages/ChatGameLine.swift). The game it names is read by the games with friends (W8); until then every line is drawn as when the game is not known. */
export type GameLine = { kind: "invite"; text: string; button?: { title: string } } | { kind: "line"; text: string };

const outcome = (by: string | undefined, myId: string | undefined, name: string): string => (by === undefined ? "مساوی" : by === myId ? "بردی!" : `${name} برد`);

/** The line a message draws; undefined for a message that is not a game line this app draws. `myId` is my user id (the `by` of a game that ended is the winner's id). */
export function gameLine(message: Message, other: ChatPerson, myId: string | undefined): GameLine | undefined {
  const payload = payloadOf(message);
  if (!payload) return undefined;
  const name = chatName(other);
  if (message.kind === "game" && payload.event === "game_invite") {
    const game = gameName(payload.kind);
    return message.fromMe ? { kind: "invite", text: `دعوتش کردی به ${game}`, button: { title: "ببین" } } : { kind: "invite", text: `${name} دعوتت کرد به ${game}`, button: { title: "بزن بریم" } };
  }
  if (message.kind === "game" && payload.event === "challenge_result") {
    const score = persianDigits(payload.score ?? 0);
    return { kind: "line", text: message.fromMe ? `توی چالش ${name} ${score} از ۱۰ گرفتی` : `${name} توی چالشت ${score} از ۱۰ گرفت` };
  }
  if (message.kind === "system" && payload.event === "game_ended") return { kind: "line", text: `${gameName(payload.kind)} با ${name} تموم شد · ${outcome(payload.by, myId, name)}` };
  return undefined;
}
