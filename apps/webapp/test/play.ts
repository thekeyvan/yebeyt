import type { DuelResult, FriendGame, GamePlayer, MoshMove } from "../lib/play/models";

/** Games as the server writes them, for the tests of the games with friends (`GameJSON` in the phone's `MoshStateTests`). */
export const player = (username: string, seat: number, score = 0, name: string | null = null): GamePlayer => ({ username, displayName: name, avatar: null, seat, score });

export const move = (n: number, by: string, key: string, m1: string, m2: string): MoshMove => ({ n, username: by, key, m1, m2, createdAt: `2026-11-24T09:4${n}:00.000Z` });

/** «یاد باد آن که نهانت نظری با ما بود / رقم مهر تو بر چهره‌ی ما پیدا بود»: ends with د. */
export const saraMove = move(1, "sara.ghazal", "/hafez/ghazal/sh2#0", "یاد باد آن که نهانت نظری با ما بود", "رقم مهر تو بر چهره‌ی ما پیدا بود");

export const sara = player("sara.ghazal", 0, 1, "سارا");
export const niloofar = player("niloofar", 1);

export function game(extra: Partial<FriendGame> = {}): FriendGame {
  return {
    id: "g1",
    kind: "mosh",
    turnSeconds: 86_400,
    status: "active",
    code: "M4R9",
    createdAt: "2026-11-24T09:00:00.000Z",
    endedAt: null,
    winner: null,
    endReason: null,
    players: [sara, niloofar],
    turn: { username: "niloofar", deadline: "2026-11-25T09:40:00.000Z" },
    moves: [],
    rounds: [],
    ...extra,
  };
}

export const duelResult = (round: number, winner: string | null): DuelResult => ({ round, type: "second", key: `/hafez/ghazal/sh${round}#0`, m1: "الف", m2: "ب", meaning: `معنی ${round}`, poet: "hafez", bookTitle: "غزلیات", winner });
