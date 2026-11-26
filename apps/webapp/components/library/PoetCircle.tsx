"use client";

import { useState } from "react";
import { usePictures } from "../../lib/library/browser";
import { poetLetter, type LibraryPoet } from "../../lib/library/models";
import { pictureURL } from "../../lib/library/pictures";
import { poetCardCircleColor, poetCircleColor } from "./palette";

/**
 * A poet's picture: the real one from the server when the browser has it, else a sticker circle in the poet's colour with the first letter of
 * their name. The avatar is always a circle (Design/PoetCircle.swift). The picture fades in over the letter once it has loaded.
 * `onCard`: on the poet's own card the circle is a shade darker than the card.
 */
export function PoetCircle({ poet, size = 70, border = 4, onCard }: { poet: LibraryPoet; size?: number; border?: number; onCard?: boolean }) {
  const entry = usePictures()[poet.slug];
  const [loaded, setLoaded] = useState<string>();
  const source = entry && pictureURL(entry);
  return (
    <span
      aria-hidden
      data-testid={`circle-${poet.slug}`}
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full border-solid border-white"
      style={{
        width: size,
        height: size,
        borderWidth: border,
        background: (onCard ? poetCardCircleColor : poetCircleColor)[poet.color],
        boxShadow: onCard ? "0 3px 5px rgba(10,10,61,0.3)" : "0 2px 4px rgba(20,17,43,0.22)",
      }}
    >
      <span className="font-title text-white" style={{ fontSize: size * 0.5, paddingTop: size * 0.1, lineHeight: 1 }}>
        {poetLetter(poet)}
      </span>
      {source && (
        <img src={source} alt="" onLoad={() => setLoaded(source)} className={`absolute inset-0 size-full rounded-full object-cover transition-opacity duration-150 ${loaded === source ? "opacity-100" : "opacity-0"}`} />
      )}
    </span>
  );
}

/** A poet's circle with the name under it: a fixed-width label that wraps to a second line (long names), while the picture stays a circle. */
export function PoetTile({ poet }: { poet: LibraryPoet }) {
  return (
    <span className="flex w-[76px] flex-col items-center gap-[5px]">
      <PoetCircle poet={poet} />
      <span className="line-clamp-2 w-[76px] pb-0.5 text-center text-xs leading-[1.7] font-bold text-ink">{poet.name}</span>
    </span>
  );
}
