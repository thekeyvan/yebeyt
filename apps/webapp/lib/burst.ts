// The pieces that come out of a control on a success (Design/Burst.swift): hearts rise from a like, bookmark ribbons fan out of a
// keep, arrows circle out of a repost; a send has none, its icon flies off and lands back. No crescents or stars. Pieces are
// made from a seed, so a burst can be tested.

export type BurstAction = "like" | "keep" | "repost" | "send";
export type Kind = "heart" | "ribbon" | "arrow";
export type Tint = "magenta" | "lapis" | "fire";
/** How the pieces travel: up in a fan drifting side to side, out in an upward fan, or out along a curve, circling. */
export type Flight = "rise" | "fan" | "orbit";

type Recipe = { kinds: Kind[]; count: [number, number]; tints: Tint[]; flight: Flight; radius: number; size: number };

const recipes: Record<Exclude<BurstAction, "send">, Recipe> = {
  like: { kinds: ["heart"], count: [4, 6], tints: ["fire", "magenta"], flight: "rise", radius: 46, size: 13 },
  keep: { kinds: ["ribbon"], count: [3, 4], tints: ["lapis"], flight: "fan", radius: 38, size: 13 },
  repost: { kinds: ["arrow"], count: [2, 2], tints: ["lapis"], flight: "orbit", radius: 34, size: 12 },
};

export type Piece = {
  id: number;
  /** Where it flies, in radians from the physical right, clockwise on screen. */
  angle: number;
  distance: number;
  size: number;
  /** Degrees: how wide a heart drifts, how far an arrow circles. */
  spin: number;
  kind: Kind;
  tint: Tint;
  flight: Flight;
};

/** mulberry32: a small seeded generator, so the same seed gives the same burst. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The `index`th of `count` angles spread over `span` radians around straight up. */
const fan = (index: number, count: number, span: number, jitter: number): number => {
  const slot = span / count;
  return -Math.PI / 2 - span / 2 + (index + 0.5 + jitter * 0.6) * slot;
};

/** The pieces of `action`'s burst: spread around the circle (or the fan), each with a little jitter. */
export function pieces(action: BurstAction, seed: number): Piece[] {
  if (action === "send") return [];
  const { kinds, count: range, tints, flight, radius, size } = recipes[action];
  const random = generator(seed);
  const between = (low: number, high: number) => low + random() * (high - low);
  const count = range[0] + Math.floor(random() * (range[1] - range[0] + 1));
  const step = (2 * Math.PI) / count;
  const start = between(0, step);
  return Array.from({ length: count }, (_, index) => {
    const jitter = between(-0.3, 0.3);
    const angle = flight === "orbit" ? start + (index + jitter) * step : fan(index, count, flight === "fan" ? (2 * Math.PI) / 3 : 1.2, jitter);
    const spin = flight === "fan" ? between(-200, 200) : between(120, 200) * (flight === "orbit" ? (index % 2 === 0 ? 1 : -1) : random() < 0.5 ? 1 : -1);
    return {
      id: index,
      angle: (angle + 4 * Math.PI) % (2 * Math.PI),
      distance: radius * between(0.7, 1),
      size: size * between(0.8, 1.2),
      spin,
      kind: kinds[(index + Math.floor(random() * kinds.length)) % kinds.length]!,
      tint: tints[Math.floor(random() * tints.length)]!,
      flight,
    };
  });
}

/** Where a piece is `progress` (0…1) of the way through the burst: out fast, slowing down, fading in the second half. */
export type Frame = {
  dx: number;
  dy: number;
  opacity: number;
  scale: number;
  /** Degrees: the way a piece that points somewhere (a ribbon, an arrow) points. */
  heading: number;
};

export function frame(piece: Piece, progress: number): Frame {
  const eased = 1 - (1 - progress) ** 3;
  let { dx, dy, heading } = { dx: 0, dy: 0, heading: 0 };
  switch (piece.flight) {
    case "fan":
      dx = Math.cos(piece.angle) * piece.distance * eased;
      dy = Math.sin(piece.angle) * piece.distance * eased;
      heading = (piece.angle * 180) / Math.PI;
      break;
    case "rise":
      dx = Math.cos(piece.angle) * piece.distance * 0.35 * eased + piece.spin * 0.04 * Math.sin(progress * 2 * Math.PI);
      dy = Math.sin(piece.angle) * piece.distance * eased;
      break;
    case "orbit": {
      const angle = piece.angle + ((piece.spin * Math.PI) / 180) * eased;
      dx = Math.cos(angle) * piece.distance * eased;
      dy = Math.sin(angle) * piece.distance * eased;
      heading = (angle * 180) / Math.PI + (piece.spin > 0 ? 90 : -90);
    }
  }
  return {
    dx,
    dy,
    heading,
    opacity: progress <= 0 || progress >= 1 ? 0 : progress < 0.45 ? 1 : 1 - (progress - 0.45) / 0.55,
    scale: progress < 0.45 ? 0.5 + 0.5 * Math.min(progress / 0.2, 1) : 1 - (0.5 * (progress - 0.45)) / 0.55,
  };
}
