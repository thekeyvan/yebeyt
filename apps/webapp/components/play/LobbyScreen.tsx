"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Services } from "../../lib/account/services";
import type { PersonShort } from "../../lib/friends/models";
import { useStore } from "../../lib/library/browser";
import { cn } from "../../lib/cn";
import { LobbyModel, challengeOf, hasTurnTime, lobbyGames, lobbyTitle, turnChoices, type LobbyGame, type LobbyStart } from "../../lib/play/lobbyModel";
import { playCopy } from "../../lib/play/copy";
import { challengeRoundURL, gameURL } from "../../lib/play/routes";
import { FacePerson } from "../friends/FacePerson";
import { PeoplePickSheet } from "../friends/PeoplePickSheet";
import { BigButton, GamePage } from "../games/chrome";
import { useGame } from "../games/GameCover";
import { GameIcon } from "../games/GameIcon";
import { RoundButton } from "../library/chrome";
import { CheckIcon, ChevronRightIcon } from "../ui/icons";
import { Segmented } from "../ui/Segmented";
import { toast } from "../ui/Toast";
import { ShareLinks } from "./ShareLinks";
import { useSignedInServices } from "./useGuarded";

const muted = "text-[11.5px] text-[#8A8698]";

/** GameLobby: the game, the turn time (مشاعره only), who to invite, and the link for those without the app (Play/LobbyScreen.swift). */
export function LobbyScreen({ start }: { start: LobbyStart }) {
  const services = useSignedInServices();
  return services ? <Lobby services={services} start={start} /> : <LobbyFrame>{null}</LobbyFrame>;
}

function LobbyFrame({ children }: { children: ReactNode }) {
  const { requestClose } = useGame();
  return (
    <GamePage
      header={
        <div className="flex items-center gap-3">
          <RoundButton label="برگشت" onClick={requestClose}>
            <ChevronRightIcon size={20} lineWidth={2.6} />
          </RoundButton>
          <h1 className="pt-[3px] text-[28px] text-ink">بازی با دوست</h1>
        </div>
      }
    >
      {children}
    </GamePage>
  );
}

function Lobby({ services, start }: { services: Services; start: LobbyStart }) {
  const router = useRouter();
  const [model] = useState(() => new LobbyModel(start, services.api));
  useStore(model);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => void model.loadFriends(), [model]);

  const { game } = model;
  const footer = game === "mosh" ? playCopy.lobbyFooter : game === "duel" ? playCopy.lobbyDuelFooter : playCopy.lobbyChallengeFooter;

  async function make() {
    const made = await model.makeGame(services.games, (text, username) => services.messages.sendText(text, username));
    if (made && model.skippedLine) toast(model.skippedLine);
    return made;
  }

  /** A tap on a way to share the link makes the game first (the link has its code), with the invitations picked so far. */
  async function prepareShare() {
    try {
      const made = await make();
      if (!made) return undefined;
      const url = `https://${playCopy.gameLink(made.code)}`;
      return { text: playCopy.gameShare(game === "duel" ? "بازی رودررو" : "مشاعره", url), url };
    } catch (error) {
      toast(playCopy.gameError(error));
      return undefined;
    }
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const { plan } = model;
      if (plan.kind === "challenge") return router.replace(challengeRoundURL(plan.game, plan.invite));
      const made = await make();
      if (made) router.replace(gameURL(plan.game, made.id));
    } catch (error) {
      toast(playCopy.gameError(error));
    } finally {
      setBusy(false);
    }
  }

  const pick = (username: string) => model.toggle(username) || toast(playCopy.tooManyInvites);

  return (
    <LobbyFrame>
      <div data-testid="lobby" className="flex flex-col gap-3 pb-4">
        <p className="text-[13px] font-bold text-ink">چی بازی کنیم؟</p>
        <div className="grid grid-cols-4 gap-2">
          {lobbyGames.map((one) => (
            <Tile key={one} game={one} on={one === game} choose={() => (model.game = one)} />
          ))}
        </div>

        {hasTurnTime(game) && (
          <div className="flex flex-col gap-[7px]">
            <p className="text-[13px] font-bold text-ink">وقت هر نوبت</p>
            <Segmented
              look="divan"
              label="وقت هر نوبت"
              value={String(model.turnSeconds)}
              onValueChange={(value) => (model.turnSeconds = Number(value))}
              options={turnChoices.map((seconds) => ({ value: String(seconds), label: playCopy.turnTime(seconds) }))}
            />
            <p className={muted}>«تا فردا» یعنی هر وقت سرت خلوت شد جواب بدی؛ وقتی نوبتت شد، توی بازی‌ها می‌بینی.</p>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-3xl bg-white px-4 py-3.5 shadow-[0_3px_6px_rgba(20,17,43,0.08)]">
          <p className="text-[13px] font-bold text-ink">کی رو دعوت کنی؟</p>
          <div className="-mx-1 flex items-start gap-3.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
            {model.people.map((person) => (
              <Person key={person.username} person={person} on={model.selected.includes(person.username)} toggle={() => pick(person.username)} />
            ))}
            <button type="button" data-testid="lobby-more" onClick={() => setPicking(true)} className="flex shrink-0 flex-col items-center gap-1">
              <span className="grid size-[50px] place-items-center rounded-full border-2 border-dashed border-[#B9B4C6] text-[22px] text-muted">+</span>
              <span className="text-xs text-muted">بیشتر</span>
            </button>
          </div>
          {challengeOf(game) === undefined && (
            <div className="flex flex-col gap-2">
              <hr className="border-t border-dashed border-[#E6E1D6]" />
              <div className="flex items-baseline gap-2">
                <p className="flex-1 text-[13px] font-bold text-ink">اپ رو نداره؟ لینک بفرست</p>
                <span dir="ltr" data-testid="lobby-link" className="text-xs font-bold text-lapis">
                  {model.linkText}
                </span>
              </div>
              <ShareLinks prepare={prepareShare} />
              <p className={cn(muted, "leading-[1.7]")}>با لینک، بدون نصب هم می‌تونه بیاد توی بازی.</p>
            </div>
          )}
        </div>

        <BigButton compact className="h-14 text-[21px]" disabled={busy} onClick={() => void submit()} data-testid="lobby-create">
          بساز و دعوت کن
        </BigButton>
        <p className={cn(muted, "text-center")}>{footer}</p>
      </div>
      <PeoplePickSheet
        services={services}
        open={picking}
        onClose={() => setPicking(false)}
        title="کی رو دعوت کنی؟"
        invite
        choose={async (person) => (model.add(person) ? undefined : playCopy.tooManyInvites)}
      />
    </LobbyFrame>
  );
}

function Tile({ game, on, choose }: { game: LobbyGame; on: boolean; choose: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={lobbyTitle(game)}
      data-testid={`lobby-game-${game}`}
      onClick={choose}
      className={cn("flex flex-col items-center gap-1.5 rounded-[18px] border-[3px] bg-white px-1 pt-2.5 pb-2 shadow-[0_2px_4px_rgba(20,17,43,0.06)]", on ? "border-lapis" : "border-white")}
    >
      <GameIcon kind={game} size={42} />
      <span className={cn("max-w-full truncate text-xs text-ink", on ? "font-bold" : "font-medium")}>{lobbyTitle(game)}</span>
    </button>
  );
}

function Person({ person, on, toggle }: { person: PersonShort; on: boolean; toggle: () => void }) {
  return (
    <button type="button" aria-pressed={on} data-testid={`lobby-person-${person.username}`} onClick={toggle} className="flex w-14 shrink-0 flex-col items-center gap-1">
      <span className={cn("relative", on ? "" : "opacity-75")}>
        <FacePerson parts={person.avatar} size={50} />
        {on && (
          <span className="absolute -bottom-0.5 -start-0.5 grid size-5 place-items-center rounded-full border-[3px] border-white bg-lapis text-white">
            <CheckIcon size={12} lineWidth={3.6} />
          </span>
        )}
      </span>
      <span className={cn("max-w-full truncate text-xs text-ink", on ? "font-bold" : "font-medium")}>{person.displayName?.trim() || person.username}</span>
    </button>
  );
}
