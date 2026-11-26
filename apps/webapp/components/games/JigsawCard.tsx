import { sourceOf } from "../../lib/games/couplet";
import { statusOf, type JigsawBoard } from "../../lib/games/jigsawBoard";
import { persianDigits } from "../../lib/persian";
import { WordSticker } from "../ui/WordSticker";
import { PeeledCorner } from "./chrome";

function Slot({ board, position, revealed, tap }: { board: JigsawBoard; position: number; revealed: boolean; tap: (position: number) => void }) {
  const word = board.word(position);
  const waiting = board.question.missing.includes(position) && !revealed;
  const mark = revealed ? board.mark(position) : undefined;
  const right = board.question.words[position]!;
  const spoken = mark === "right" ? "درست" : mark === "wrong" ? `نشد، درستش: ${right}` : (word ?? "خالی");
  return (
    <span className="flex flex-col items-center gap-[3px]">
      {word === undefined || waiting ? (
        <button
          type="button"
          onClick={() => tap(position)}
          aria-label={`جای ${persianDigits(position + 1)}`}
          aria-description={spoken}
          data-testid={`slot-${position}`}
          data-drop={position}
          data-filled={word !== undefined}
          className={word === undefined ? "size-[46px] rounded-[14px] border-2 border-dashed border-[#B9B4C6] bg-paper" : "rounded-word"}
        >
          {word !== undefined && <WordSticker word={word} status="stuck" size={22} />}
        </button>
      ) : (
        <span role="img" aria-label={`جای ${persianDigits(position + 1)}`} aria-description={spoken} data-testid={`slot-${position}`} data-mark={mark}>
          <WordSticker word={word} status={mark ? statusOf(mark) : "stuck"} size={22} />
        </span>
      )}
      {mark === "wrong" && (
        <span aria-hidden data-testid={`right-word-${position}`} className="font-poem text-sm leading-[1.4] text-[#3E9A1E]">
          {right}
        </span>
      )}
    </span>
  );
}

/**
 * The couplet of جورچین بیت on a white card: the first hemistich whole, the second as word slots (Games/JigsawCard.swift). Once the couplet is answered
 * (`revealed`) each word shows what the player placed, green when right and red when not, with the right word under the red one; the bulb's words keep their look.
 */
export function JigsawCard({ board, revealed, tap }: { board: JigsawBoard; revealed: boolean; tap: (position: number) => void }) {
  const { couplet, words } = board.question;
  return (
    <section data-testid="jigsaw-card" aria-label="بیت" className="relative flex flex-col gap-4 rounded-[26px] bg-white px-4 pt-[26px] pb-6 shadow-[0_4px_7px_rgba(20,17,43,0.14)]">
      <p className="text-center font-poem text-[28px] leading-[1.8] text-ink">{couplet.m1}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {words.map((_, position) => (
          <Slot key={position} board={board} position={position} revealed={revealed} tap={tap} />
        ))}
      </div>
      <PeeledCorner />
      <span className="absolute start-[22px] -top-3.5 rotate-(--tilt-decorative) rounded-pill border-4 border-white bg-magenta px-[13px] py-[3px] text-[13px] font-bold leading-[1.5] text-white shadow-[0_2px_6px_rgba(20,17,43,0.22)]">{sourceOf(couplet)}</span>
    </section>
  );
}
