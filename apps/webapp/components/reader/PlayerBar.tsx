"use client";

import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { motion } from "motion/react";
import { useState } from "react";
import { bouncy, menuArrival, useVariant, usePress } from "../../lib/motion";
import { persianClock } from "../../lib/persian";
import { isPlaying, type PlayerView, type RecitationPlayer } from "../../lib/reader/player";
import { Sheet } from "../ui/Sheet";
import { PlayIcon, VoiceIcon } from "../ui/icons";

/**
 * The recitation's bar (the board «Player», as a bar over the reader): play and pause, whose voice it is, the seek bar with the time read and the
 * time left, and «صدای دیگه» to choose another voice when the poem has several. It shows while the recitation plays or is paused.
 */
export function PlayerBar({ player, view, couplet }: { player: RecitationPlayer; view: PlayerView; couplet: number }) {
  const [voices, setVoices] = useState(false);
  const press = usePress();
  const v = useVariant();
  const on = isPlaying(view);
  const known = view.duration > 0;
  return (
    <motion.section
      aria-label="خوانش"
      initial={{ ...menuArrival(v), opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={bouncy}
      className="absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] flex flex-col gap-1 rounded-[22px] bg-white px-3.5 py-2.5 text-ink shadow-[0_3px_12px_rgba(20,17,43,0.10)]"
    >
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          {...press}
          aria-label={on ? "مکث" : "پخش خوانش"}
          onClick={() => player.toggle(couplet)}
          className="grid size-[46px] shrink-0 place-items-center rounded-full border-[3px] border-white bg-lapis text-white shadow-[0_2px_6px_rgba(20,17,43,0.25)]"
        >
          {on ? (
            <span className="flex gap-1">
              <span className="h-[18px] w-1.5 rounded-sm bg-current" />
              <span className="h-[18px] w-1.5 rounded-sm bg-current" />
            </span>
          ) : (
            <PlayIcon size={18} />
          )}
        </motion.button>
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold">{view.voice ? `با صدای ${view.voice.audioArtist}` : " "}</p>
        {view.recitations.length > 1 && (
          <button type="button" onClick={() => setVoices(true)} className="flex shrink-0 items-center gap-1.5 rounded-pill bg-paper px-3 py-[7px] text-[13px] font-bold">
            <VoiceIcon size={16} lineWidth={2.2} />
            صدای دیگه
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs font-medium text-muted">
        <span className="w-9 text-center">{persianClock(view.position)}</span>
        <Slider value={Math.min(view.position, view.duration)} min={0} max={known ? view.duration : 1} step={0.1} largeStep={5} disabled={!known} onValueChange={(value) => player.seekTo(value as number)} className="flex-1">
          <SliderControl className="relative flex h-6 items-center">
            <SliderTrack className="relative h-1.5 w-full rounded-[3px] bg-track-light">
              <SliderIndicator className="absolute inset-y-0 rounded-[3px] bg-amber" />
              <SliderThumb aria-label="جای پخش" className="size-4 rounded-full border-[3px] border-white bg-amber shadow-[0_1px_4px_rgba(20,17,43,0.3)]" />
            </SliderTrack>
          </SliderControl>
        </Slider>
        <span className="w-9 text-center">{`−${persianClock(Math.max(view.duration - view.position, 0))}`}</span>
      </div>
      <Sheet open={voices} onOpenChange={setVoices} title="صدای دیگه">
        <ul className="flex w-full flex-col">
          {view.recitations.map((item) => (
            <li key={item.id} className="border-t border-paper first:border-t-0">
              <button
                type="button"
                aria-pressed={item.id === view.voice?.id}
                onClick={() => {
                  player.choose(item.id, couplet);
                  setVoices(false);
                }}
                className={`flex w-full items-center gap-3 py-3 text-start text-[15px] font-medium ${item.id === view.voice?.id ? "font-bold text-lapis" : ""}`}
              >
                <VoiceIcon size={20} lineWidth={2.2} />
                {item.audioArtist}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </motion.section>
  );
}
