"use client";

import { useMemo, useState } from "react";
import type { Services } from "../../lib/account/services";
import { cn } from "../../lib/cn";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { useCorpus, useStore } from "../../lib/library/browser";
import { plain } from "../../lib/library/normalize";
import { playCopy } from "../../lib/play/copy";
import { letters, prefixEnd } from "../../lib/play/moshLetters";
import type { MoshState } from "../../lib/play/moshState";
import { match, suggestions, type MoshCandidate } from "../../lib/play/moshSuggestions";
import { useDivanEntries } from "../me/useDivanEntries";
import { usePoetName } from "../messages/useCouplet";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { toast } from "../ui/Toast";

const suggestionLimit = 6;

/** The first letters of a suggestion in bold lapis: what it has in common with what is typed. */
function Prefix({ text, count }: { text: string; count: number }) {
  const end = prefixEnd(text, count);
  return (
    <>
      <b className="font-bold text-lapis">{text.slice(0, end)}</b>
      {text.slice(end)}
    </>
  );
}

/**
 * The bottom of PlayMosh: whose turn, the field for the couplet, the couplets of the divan and the books that start with the letter, and «کم آوردم». A couplet picked
 * or typed is matched with the bundled books here before it is sent (Play/MoshPanel.swift).
 */
export function MoshPanel({ state, services }: { state: MoshState; services: Services }) {
  const { games, marks } = services;
  const poetName = usePoetName();
  useStore(marks);
  const { entries: divan } = useDivanEntries(marks.keptItems());
  const { value: corpus } = useCorpus();
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);
  const [resigning, setResigning] = useState(false);
  const books = corpus?.entries ?? [];
  const { requiredLetter } = state;
  const used = useMemo(() => state.usedKeys, [state.game.moves.length]);
  const shown = useMemo(
    () => (state.isMyTurn ? suggestions({ letter: requiredLetter, typed, divan, books, used, limit: suggestionLimit }) : []),
    [state.isMyTurn, requiredLetter, typed, divan, books, used],
  );

  async function send(candidate: MoshCandidate) {
    if (sending) return;
    setSending(true);
    const line = await games.play(candidate, state.game.id);
    setSending(false);
    if (line) toast(line);
    else setTyped("");
  }

  /** The typed text is looked for in the divan and the bundled books; a couplet that isn't found is not sent. */
  function sendTyped() {
    const found = match(typed, { letter: requiredLetter, divan, books, used });
    switch (found.kind) {
      case "found":
        return void send(found.candidate);
      case "notFound":
        return toast(playCopy.notFound);
      case "wrongLetter":
        return toast(playCopy.wrongLetter(requiredLetter));
      case "alreadyPlayed":
        return toast(playCopy.alreadyPlayed);
    }
  }

  return (
    <div data-testid="mosh-panel" className="flex flex-col gap-2.5 rounded-t-[26px] bg-white/70 px-3.5 pt-3.5 pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2 text-ink">
        {state.isMyTurn && requiredLetter ? (
          <p className="flex items-center gap-2 text-sm font-bold">
            نوبت توئه، با
            <span data-testid="mosh-letter" aria-label={`حرف ${requiredLetter}`} className="rounded-[10px] border-[3px] border-white bg-amber px-2.5 pt-[3px] font-title text-xl leading-[1.4] shadow-[0_2px_3px_rgba(20,17,43,0.18)]">
              {requiredLetter}
            </span>
            شروع کن
          </p>
        ) : (
          <p data-testid="mosh-turn-line" className="text-sm font-bold">
            {state.turnLine}
          </p>
        )}
        <button type="button" data-testid="mosh-resign" onClick={() => setResigning(true)} className="ms-auto text-xs font-bold text-fire">
          کم آوردم
        </button>
      </div>
      {state.isMyTurn && (
        <>
          <div {...feedbackPrivate}>
            <input
              data-testid="mosh-field"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && sendTyped()}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="بیت"
              placeholder="بنویس یا از پیشنهادها بردار"
              className="h-[46px] w-full rounded-2xl border-2 border-lapis bg-white px-3.5 font-poem text-base text-ink placeholder:font-ui placeholder:text-xs placeholder:text-[#8A8698]"
            />
          </div>
          {shown.length > 0 && (
            <section aria-label="پیشنهادها" className="flex flex-col gap-2.5">
              <h2 className="text-xs font-bold text-muted">از دیوانت و کتابخونه</h2>
              <ul className="flex max-h-[190px] flex-col gap-2 overflow-y-auto">
                {shown.map((candidate) => (
                  <li key={candidate.key}>
                    <button
                      type="button"
                      data-testid={`mosh-suggestion-${candidate.key}`}
                      disabled={sending}
                      onClick={() => void send(candidate)}
                      className={cn("flex w-full flex-col items-start gap-0.5 rounded-2xl bg-white px-3 py-2 text-start text-ink shadow-[0_2px_3px_rgba(20,17,43,0.06)]")}
                    >
                      <span {...feedbackPrivate} className="font-poem text-[15px] leading-[1.8]">
                        <Prefix text={plain(candidate.couplet.m1)} count={Math.max(1, letters(typed).length)} />
                      </span>
                      <span className="text-[11px] text-[#8A8698]">{candidate.inDivan ? `${poetName(candidate.poetSlug)} · توی دیوانت` : poetName(candidate.poetSlug)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-center text-[11.5px] text-[#8A8698]">بیتی که خودت بنویسی رو با کتابخونه چک می‌کنیم؛ تکراری قبول نیست.</p>
        </>
      )}
      <ConfirmSheet
        open={resigning}
        onOpenChange={setResigning}
        title="کم آوردی؟ بازی رو می‌بازی."
        confirm="کم آوردم"
        onConfirm={async () => {
          const line = await games.resign(state.game.id);
          if (line) toast(line);
        }}
      />
    </div>
  );
}
