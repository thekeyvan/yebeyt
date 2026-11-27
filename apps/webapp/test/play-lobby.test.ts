import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/account/api";
import { lobbyGames, LobbyModel, lobbyTitle, turnChoices, type LobbyStart } from "../lib/play/lobbyModel";
import type { FriendGame, GameCreated } from "../lib/play/models";
import { game } from "./play";

// The port of LobbyModelTests (PlayLobbyChallengeTests.swift).

const face = (username: string, name: string | null = null) => ({ username, displayName: name, avatar: null });
const page = (names: string[], cannotPlay: string[] = []) => ({ items: names.map((name) => ({ ...face(name), canPlay: !cannotPlay.includes(name) })), nextCursor: null });
const waiting: FriendGame = game({ id: "made", status: "waiting", turn: null });
const created = (extra: Partial<GameCreated> = {}): GameCreated => ({ game: waiting, invited: [], skipped: [], ...extra });

/** A games store that records what it was asked to make, and answers one at a time. */
function rig(answer: () => Promise<GameCreated> = async () => created()) {
  const made: { kind: string; turnSeconds: number | undefined; invite: readonly string[] }[] = [];
  const games = { create: async (kind: "mosh" | "duel", turnSeconds: number | undefined, invite: readonly string[]) => (made.push({ kind, turnSeconds, invite }), answer()) };
  return { made, games: games as never };
}

async function lobby(start: LobbyStart = {}, names = ["sara.ghazal", "kian_k", "mahsa.m", "bardia"], cannotPlay: string[] = []) {
  const model = new LobbyModel(start, { friends: async () => page(names, cannotPlay) });
  await model.loadFriends();
  return model;
}

describe("the lobby's choices", () => {
  it("makes a مشاعره with a turn time and the invited usernames", async () => {
    const model = await lobby();
    model.toggle("sara.ghazal");
    model.toggle("kian_k");
    model.turnSeconds = 120;
    expect(model.plan).toEqual({ kind: "friendGame", game: "mosh", turnSeconds: 120, invite: ["sara.ghazal", "kian_k"] });
  });

  it("starts the turn time at tomorrow, and only مشاعره has one", async () => {
    const model = await lobby();
    expect([model.turnSeconds, turnChoices]).toEqual([86_400, [30, 120, 86_400]]);
    model.game = "duel";
    expect(model.plan).toEqual({ kind: "friendGame", game: "duel", invite: [] });
    expect(lobbyGames.map((one) => lobbyTitle(one))).toEqual(["مشاعره", "رودررو", "جورچین", "حدس شاعر"]);
  });

  it("makes jigsaw and poet challenges played first, and makes no game on the server", async () => {
    const model = await lobby({ game: "jigsaw", friend: face("sara.ghazal", "سارا") });
    expect(model.plan).toEqual({ kind: "challenge", game: "jigsaw", invite: ["sara.ghazal"] });
    model.game = "poet";
    expect(model.plan).toEqual({ kind: "challenge", game: "poet", invite: ["sara.ghazal"] });
    const { made, games } = rig();
    expect(await model.makeGame(games)).toBeUndefined();
    expect(made).toEqual([]);
  });

  it("puts a friend from the chat first, and chosen", async () => {
    const model = await lobby({ game: "duel", friend: face("sara.ghazal", "سارا") }, ["kian_k", "sara.ghazal", "mahsa.m", "bardia"]);
    expect([model.game, model.selected]).toEqual(["duel", ["sara.ghazal"]]);
    expect(model.people.map((one) => one.username)).toEqual(["sara.ghazal", "kian_k", "mahsa.m"]);
  });

  it("leaves a friend who cannot play out of the row", async () => {
    const model = await lobby({}, ["yebeyt", "sara.ghazal", "kian_k", "mahsa.m", "bardia"], ["yebeyt"]);
    expect(model.people.map((one) => one.username)).toEqual(["sara.ghazal", "kian_k", "mahsa.m"]);
  });

  it("shows three friends, and whoever was found with «بیشتر»", async () => {
    const model = await lobby();
    expect(model.people.map((one) => one.username)).toEqual(["sara.ghazal", "kian_k", "mahsa.m"]);
    expect(model.add(face("arian", "آرین"))).toBe(true);
    expect([model.people.at(-1)?.username, model.selected]).toEqual(["arian", ["arian"]]);
  });

  it("invites at most five people, and always lets one go", async () => {
    const model = await lobby();
    for (const name of ["a1", "a2", "a3", "a4", "a5"]) expect(model.toggle(name)).toBe(true);
    expect(model.toggle("a6")).toBe(false);
    expect(model.selected).toHaveLength(5);
    expect(model.toggle("a3")).toBe(true);
    expect(model.selected).toEqual(["a1", "a2", "a4", "a5"]);
  });
});

describe("making the game", () => {
  it("makes it once for the link and the button", async () => {
    const model = await lobby();
    model.toggle("sara.ghazal");
    expect(model.linkText).toBe("yebeyt.com/g/…");
    const { made, games } = rig();
    const first = await model.makeGame(games);
    const second = await model.makeGame(games);
    expect([first?.id, second?.id]).toEqual(["made", "made"]);
    expect(made).toEqual([{ kind: "mosh", turnSeconds: 86_400, invite: ["sara.ghazal"] }]);
    expect(model.linkText).toBe("yebeyt.com/g/M4R9");
  });

  it("tells who could not be invited, and makes the game anyway", async () => {
    const model = await lobby();
    const { games } = rig(async () => created({ invited: ["sara.ghazal"], skipped: [{ username: "kian_k", reason: "friends_only" }, { username: "ghost", reason: "not_found" }, { username: "niloofar", reason: "yourself" }] }));
    expect(model.skippedLine).toBeUndefined();
    expect((await model.makeGame(games))?.id).toBe("made");
    expect(model.skippedLine).toBe("kian_k فقط از دوستاش دعوت به بازی می‌گیره؛ ghost رو پیدا نکردیم");
  });

  it("makes one game when the link and the button are tapped together", async () => {
    const model = await lobby();
    const { made, games } = rig(() => new Promise((resolve) => setTimeout(() => resolve(created()), 30)));
    const both = await Promise.all([model.makeGame(games), model.makeGame(games)]);
    expect(both.map((one) => one?.id)).toEqual(["made", "made"]);
    expect(made).toHaveLength(1);
  });

  it("sends the link in a chat to friends picked after the game was made, once", async () => {
    const model = await lobby();
    const { made, games } = rig(async () => created({ invited: ["sara.ghazal"] }));
    const sent: string[] = [];
    const send = async (text: string, username: string) => (sent.push(`${username}: ${text}`), undefined);
    model.toggle("sara.ghazal");
    await model.makeGame(games, send);
    expect(sent).toEqual([]); // she was in the invitations
    model.toggle("kian_k");
    await model.makeGame(games, send);
    await model.makeGame(games, send);
    expect(sent).toEqual(["kian_k: بیا مشاعره کنیم · https://yebeyt.com/g/M4R9"]);
    expect(made).toHaveLength(1);
  });

  it("tells a chat invitation that failed, and tries it again", async () => {
    const model = await lobby();
    const { games } = rig();
    model.toggle("kian_k");
    await model.makeGame(games, async () => "پیام نرفت");
    expect(model.skippedLine).toBe("kian_k: پیام نرفت");
    const sent: string[] = [];
    await model.makeGame(games, async (_text, username) => (sent.push(username), undefined));
    expect(sent).toEqual(["kian_k"]);
    expect(model.skippedLine).toBeUndefined();
  });

  it("tries a failed make again", async () => {
    const model = await lobby();
    let calls = 0;
    const { games } = rig(async () => (++calls === 1 ? Promise.reject(new ApiError(429, "rate_limited")) : created()));
    await expect(model.makeGame(games)).rejects.toBeInstanceOf(ApiError);
    expect((await model.makeGame(games))?.id).toBe("made");
  });

  it("makes a new game next time when the game or the time changed", async () => {
    const model = await lobby();
    const { made, games } = rig();
    await model.makeGame(games);
    model.turnSeconds = 30;
    expect(model.made).toBeUndefined();
    await model.makeGame(games);
    expect(made).toHaveLength(2);
  });

  it("leaves the turn time out of a رودررو", async () => {
    const model = await lobby({ game: "duel" });
    const { made, games } = rig();
    await model.makeGame(games);
    expect(made).toEqual([{ kind: "duel", turnSeconds: undefined, invite: [] }]);
  });

  it("does not use a game that came back for earlier settings", async () => {
    const model = await lobby();
    let release!: () => void;
    const { made, games } = rig(() => new Promise((resolve) => (release = () => resolve(created()))));
    const first = model.makeGame(games);
    model.turnSeconds = 30; // the settings change while the server thinks
    release();
    expect((await first)?.id).toBe("made");
    expect(model.made).toBeUndefined();
    expect(made).toHaveLength(1);
  });
});
