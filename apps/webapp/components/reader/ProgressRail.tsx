import { progress, progressLabel } from "../../lib/reader/text";

/** Most bars before a long poem gets one thin track instead of a bar for each couplet. */
const mostBars = 14;

/**
 * The progress rail on the left edge (Reader/ProgressRail.swift): one bar per couplet, the ones read in lapis and the current one longer, with
 * «۲ از ۹» under it. A long poem gets one thin track instead.
 */
export function ProgressRail({ index, count, secondary, track }: { index: number; count: number; secondary: string; track: string }) {
  return (
    <div role="img" aria-label={progressLabel(index, count)} className="pointer-events-none absolute end-[17px] top-1/2 flex w-[5px] -translate-y-1/2 flex-col items-center gap-[5px]">
      {count <= mostBars ? (
        Array.from({ length: count }, (_, bar) => <span key={bar} className={`w-[5px] rounded-[3px] ${bar <= index ? "bg-lapis" : track} ${bar === index ? "h-[22px]" : "h-3"}`} />)
      ) : (
        <span className={`relative h-[200px] w-[5px] rounded-pill ${track}`}>
          <span className="absolute inset-x-0 top-0 rounded-pill bg-lapis" style={{ height: `${((index + 1) / count) * 100}%` }} />
        </span>
      )}
      {/* The text is wider than the bars and spills over both sides, so the rail's inset stays the board's. */}
      <span aria-hidden className={`mt-1 whitespace-nowrap text-[11px] leading-normal font-bold ${secondary}`}>
        {progress(index, count)}
      </span>
    </div>
  );
}
