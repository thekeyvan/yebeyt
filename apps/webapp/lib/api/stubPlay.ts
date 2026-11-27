import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// What the debug server answers for games with friends and challenges (Debug/PlayStub.swift of the phone): a مشاعره game with Sara where it is my turn (`g1`: the
// couplets chain on «س» and «د»), a رودررو game (`d1`, played by live events: the tests push them), games made in the lobby (they wait for a friend), and a challenge
// of ten couplets by Saadi (`7KQ2`, made by نیلوفر with 8 of 10). A move is kept, and two seconds later Sara's answer to it is in the game (always the same couplet:
// the stub doesn't check letters). It answers for a debug account, and for a visitor with no session that asks with `sessionStorage.beytPlayStub = "1"` (`lib/play/debug.ts`).

export const moshId = "g1";
export const duelId = "d1";
/** The duel Aryan invited me to in the chat. */
export const aryanDuelId = "g2";
export const challengeCode = "7KQ2";

const face = (skin: string, background: string) => ({ face: skin, eyes: "round", hair: "dark", mouth: "smile", accessory: "none", background });
const myFace = face("sand", "sun");
const saraFace = face("peach", "rose");
const iso = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();

/** How long Sara thinks about a move. */
const replyAfterMs = 2000;

type Move = { n: number; username: string; key: string; m1: string; m2: string; createdAt: string };

/** What a debug account has played here: its moves in `g1`, the games it made, whether it gave up. */
export class PlayWorld {
  readonly played: { move: Move; at: number }[] = [];
  readonly made = new Map<string, string>();
  resigned = false;
}

const aryanFace = face("sand", "mint");

/** Me and, once somebody has come, the other player: Sara, or Aryan in the duel he invited me to in the chat (`g2`). */
const players = (me: number, other?: number, aryan = false) => [
  { username: "niloofar", displayName: null, avatar: myFace, seat: 0, score: me },
  ...(other === undefined ? [] : [aryan ? { username: "aryan", displayName: "آرین", avatar: aryanFace, seat: 1, score: other } : { username: "sara.ghazal", displayName: "سارا", avatar: saraFace, seat: 1, score: other }]),
];

const opening = (): Move[] => [
  { n: 1, username: "niloofar", key: "/hafez/ghazal/sh267#0", m1: "ای صبا گر بُگذری بر ساحلِ رودِ اَرَس", m2: "بوسه زن بر خاکِ آن وادی و مُشکین کُن نَفَس", createdAt: iso(-7200) },
  { n: 2, username: "sara.ghazal", key: "/hafez/ghazal/sh100#2", m1: "سود و زیان و مایه چو خواهد شدن ز دست", m2: "از بهر این معامله غمگین مباش و شاد", createdAt: iso(-3600) },
];

const reply: Omit<Move, "n"> = { username: "sara.ghazal", key: "/hafez/ghazal/sh7#0", m1: "دلا نزد کسی بنشین که او از دل خبر دارد", m2: "به زیر کلک نکته‌ها", createdAt: "" };

/** `g1` as it is now: the two couplets, mine so far, and Sara's answer to each of mine that is two seconds old. */
function mosh(world: PlayWorld, id: string, resigned = world.resigned) {
  const replies = world.played.filter(({ at }) => Date.now() - at >= replyAfterMs).length;
  const moves = opening();
  world.played.forEach(({ move }, index) => {
    moves.push({ ...move, n: 3 + 2 * index });
    if (index < replies) moves.push({ ...reply, n: 4 + 2 * index, createdAt: iso(-1) });
  });
  const myTurn = world.played.length === replies;
  return {
    id,
    kind: "mosh",
    turnSeconds: 86_400,
    status: resigned ? "done" : "active",
    code: "M4R9",
    createdAt: iso(-86_400),
    endedAt: null,
    winner: resigned ? "sara.ghazal" : null,
    endReason: resigned ? "resigned" : null,
    players: players(4 + world.played.length, 3 + replies),
    turn: resigned ? null : { username: myTurn ? "niloofar" : "sara.ghazal", deadline: iso(21 * 3600 + 600) },
    moves,
    rounds: [],
  };
}

const waiting = (id: string, kind: string) => ({ id, kind, turnSeconds: kind === "duel" ? 8 : 86_400, status: "waiting", code: "M4R9", createdAt: iso(0), endedAt: null, winner: null, endReason: null, players: players(0), turn: null, moves: [], rounds: [] });

const duel = (id = duelId) => ({ id, kind: "duel", turnSeconds: 8, status: "active", code: "D4EL", createdAt: "2026-11-24T09:00:00.000Z", endedAt: null, winner: null, endReason: null, players: id === duelId ? players(2, 1) : players(0, 0, true), turn: null, moves: [], rounds: [] });

/** The first `count` couplets of the deck by a poet that a جورچین can be made of (a second hemistich of 3 to 14 words), as keys. */
function deckKeys(poet: string, count: number): string[] {
  const file = join(process.cwd(), "public", "data", "games.json");
  if (!existsSync(file)) return [];
  const entries = JSON.parse(readFileSync(file, "utf8")) as { poem: string; index: number; m2: string; poet: string }[];
  return entries.filter((entry) => entry.poet === poet && entry.m2.split(/\s+/).filter(Boolean).length >= 3 && entry.m2.split(/\s+/).filter(Boolean).length <= 14).slice(0, count).map((entry) => `${entry.poem}#${entry.index}`);
}

const challenge = () => ({ creator: { username: "nila", displayName: "نیلوفر", avatar: myFace }, game: "jigsaw", items: deckKeys("saadi", 10), score: 8, seconds: 102, label: "۱۰ بیت سعدی" });

const json = (status: number, body: unknown) => Response.json(body, { status });
const error = (status: number, code: string) => json(status, { error: code });

type Call = { method: string; pathname: string; given: Record<string, any>; hasToken: boolean; world: PlayWorld };

/** The answer for a call of games or challenges; undefined for a path that is not theirs. */
export function playAnswer({ method, pathname, given, hasToken, world }: Call): Response | undefined {
  const parts = pathname.split("/").filter(Boolean); // v1, games, g1, moves
  const route = `${method} ${pathname}`;
  switch (route) {
    case "GET /v1/me/games":
      return json(200, { items: [mosh(world, moshId)] });
    case "POST /v1/games": {
      const kind = String(given.kind ?? "mosh");
      const id = `new-${kind}`;
      world.made.set(id, kind);
      return json(201, { game: waiting(id, kind), invited: given.invite ?? [], skipped: [] });
    }
    case "POST /v1/challenges":
      return json(201, { code: challengeCode, url: `https://yebeyt.com/c/${challengeCode}` });
  }
  if (parts[1] === "challenges" && parts.length >= 3) {
    if (parts[2]!.toUpperCase() !== challengeCode) return error(404, "not_found");
    if (parts.length === 3 && method === "GET") return json(200, challenge());
    if (parts.length === 4 && parts[3] === "results" && method === "POST") {
      const name = String(given.name ?? "").trim();
      return hasToken || name !== "" ? json(201, { id: "00000000-0000-4000-8000-0000000000c1" }) : error(400, "invalid_request");
    }
  }
  if (parts[1] !== "games" || parts.length < 3) return undefined;
  const id = parts[2]!;
  if (method === "GET" && parts.length === 3) {
    if (id === duelId || id === aryanDuelId) return json(200, duel(id));
    const kind = world.made.get(id);
    if (kind) return json(200, waiting(id, kind));
    return id === moshId ? json(200, mosh(world, id)) : error(404, "not_found");
  }
  if (method !== "POST" || parts.length !== 4) return undefined;
  switch (parts[3]) {
    case "join":
      return json(200, id === duelId || id === aryanDuelId ? duel(id) : mosh(world, id, false));
    case "moves":
      world.played.push({ move: { n: 0, username: "niloofar", key: String(given.key ?? "/hafez/ghazal/sh1#0"), m1: String(given.m1 ?? ""), m2: String(given.m2 ?? ""), createdAt: iso(0) }, at: Date.now() });
      return json(200, mosh(world, id, false));
    case "resign":
      world.resigned = true;
      return json(200, mosh(world, id, true));
    default:
      return undefined;
  }
}
