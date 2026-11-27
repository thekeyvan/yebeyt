"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLibraryData, useStore } from "../../lib/library/browser";
import { plain } from "../../lib/library/normalize";
import { gameLine, type GameAction } from "../../lib/messages/gameLine";
import { chatName, payloadOf, type ChatPerson, type Message } from "../../lib/messages/models";
import { persianDigits } from "../../lib/persian";
import { playCopy } from "../../lib/play/copy";
import { gameURL } from "../../lib/play/routes";
import { useServices } from "../account/useServices";
import { LastLetter } from "../play/MoshMoves";
import { toast } from "../ui/Toast";
import { clock } from "./ChatMessages";

const go = "rounded-xl bg-lapis px-[13px] pt-[7px] pb-[3px] font-title text-base text-white";

/**
 * A game line of a chat: the مشاعره card of the Direct board, an invitation with «بزن بریم», or a line (a game that ended, the result of a challenge). The game it
 * names is read when the card shows, and live events keep it up to date (Messages/GameCardView.swift).
 */
export function GameCard({ message, other, myId }: { message: Message; other: ChatPerson; myId: string | undefined }) {
  const services = useServices();
  const router = useRouter();
  const games = services?.games;
  useStore(games);
  const payload = payloadOf(message);
  const gameId = payload?.gameId;
  const game = gameId ? games?.game(gameId) : undefined;
  const line = gameLine(message, other, game, games?.me, myId);

  const settled = game?.status === "done";
  useEffect(() => {
    if (payload?.event === "game_invite" && gameId && games && !settled) void games.load(gameId);
  }, [games, gameId, settled]);

  if (!line) return null;
  const mine = message.fromMe;
  const time = clock(message);
  const duel = payload?.kind === "duel";

  async function run({ kind, gameId: id }: GameAction) {
    if (kind === "join") {
      const failure = await games!.join(id);
      if (failure) return toast(failure);
    }
    router.push(gameURL(duel ? "duel" : "mosh", id));
  }

  if (line.kind === "line") {
    return (
      <p data-testid={`game-line-${message.id}`} className="mx-auto rounded-full bg-white/80 px-3 py-[5px] text-xs text-muted">
        {line.text}
      </p>
    );
  }
  if (line.kind === "mosh") {
    const { state } = line;
    return (
      <div className={`flex w-full flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
        <span className="text-xs text-muted">
          {mine ? `تو یه مشاعره شروع کردی · ${time}` : (
            <>
              <b className="font-bold text-ink">{chatName(other)}</b> یه مشاعره شروع کرد · {time}
            </>
          )}
        </span>
        <div data-testid={`game-card-${message.id}`} className="flex w-[262px] max-w-full flex-col gap-2 rounded-[22px] border-[5px] border-white bg-amber px-3.5 py-3 text-ink shadow-[0_3px_24px_rgba(20,17,43,0.18)]">
          <div className="flex items-center">
            <h3 className="flex-1 pt-[3px] text-xl leading-[1.3]">{`مشاعره با ${chatName(other)}`}</h3>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold">{`دور ${persianDigits(state.round)}`}</span>
          </div>
          <p className="text-xs leading-[1.7]">هر کی یه بیت می‌گه که با آخرین حرفِ بیتِ قبلی شروع بشه.</p>
          {state.lastMove && (
            <p className="flex flex-col rounded-[14px] bg-white px-3 py-2 font-poem text-[15px] leading-[1.8]">
              <span>{plain(state.lastMove.m1)}</span>
              <span>
                <LastLetter text={plain(state.lastMove.m2)} mark="bg-lapis text-white" />
              </span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <span data-testid={`game-turn-${message.id}`} className="flex-1 text-[13px] font-bold">
              {state.isDone ? state.outcomeTitle : state.turnLine}
            </span>
            <button type="button" data-testid={`game-go-${message.id}`} onClick={() => router.push(gameURL("mosh", line.gameId))} className={go}>
              {state.isMyTurn ? "جواب بده" : "ببین"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex w-full flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
      <span className="text-xs text-muted">{`${mine ? "تو" : chatName(other)} · ${time}`}</span>
      <div data-testid={`game-card-${message.id}`} className="flex w-[262px] max-w-full items-center gap-3 rounded-[22px] bg-white p-3.5 shadow-[0_3px_8px_rgba(20,17,43,0.14)]">
        <span className="flex-1 text-[13px] font-bold text-ink">{line.text}</span>
        {line.button && (
          <button type="button" data-testid={`game-go-${message.id}`} onClick={() => void run(line.button!.action)} className={go}>
            {line.button.title}
          </button>
        )}
      </div>
    </div>
  );
}
