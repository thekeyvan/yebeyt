"use client";

import { useState } from "react";
import { usePictures } from "../../lib/library/browser";
import { poetLetter, type LibraryPoet } from "../../lib/library/models";
import { pictureURL } from "../../lib/library/pictures";
import { poetCardCircleColor, poetCircleColor } from "./palette";

/**
 * A poet's picture: the real one from the server when the browser has it, else a sticker circle in the poet's colour with the first letter of
 * their name. The avatar is always a circle (Design/PoetCircle.swift). Either the picture or the letter, never both (the portraits are transparent): the letter
 * stays until the picture has loaded, and for good when there is none or it fails to load. A picture the browser already has shows at once; one still loading fades in.
 * A new version of the picture replaces the old one only once it has loaded (and not at all when it fails), as Library/PoetPictures.swift does.
 * `onCard`: on the poet's own card the circle is a shade darker than the card.
 */
export function PoetCircle({ poet, size = 70, border = 4, onCard }: { poet: LibraryPoet; size?: number; border?: number; onCard?: boolean }) {
  const entry = usePictures()[poet.slug];
  /** The last picture that loaded, and whether it fades in (not when the browser had it, nor when it takes the place of another). */
  const [loaded, setLoaded] = useState<{ source: string; fade: boolean }>();
  const source = entry && pictureURL(entry);
  const hasPicture = source !== undefined && loaded !== undefined;
  const ready = (url: string, fade: boolean) => setLoaded((was) => (was?.source === url ? was : { source: url, fade: fade && was === undefined }));
  const picture = "absolute inset-0 size-full rounded-full object-cover";
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
      {!hasPicture && (
        <span className="font-title text-white" style={{ fontSize: size * 0.5, paddingTop: size * 0.1, lineHeight: 1 }}>
          {poetLetter(poet)}
        </span>
      )}
      {source && loaded && loaded.source !== source && <img key={loaded.source} src={loaded.source} alt="" className={`${picture} opacity-100`} />}
      {source && (
        <img
          key={source}
          ref={(image) => {
            // Already there (cached) when the element is made: shown before the first paint.
            if (image?.complete && image.naturalWidth > 0) ready(source, false);
          }}
          src={source}
          alt=""
          onLoad={() => ready(source, true)}
          className={`${picture} ${loaded?.source === source ? "opacity-100" : "opacity-0"}${!loaded || (loaded.source === source && loaded.fade) ? " transition-opacity duration-150" : ""}`}
        />
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
