import { describe, expect, it } from "vitest";
import { challengeRoundURL, challengeURL, gameURL, isChallengeCode, isGameId, lobbyURL, parseInvite, parseLobby } from "../lib/play/routes";

describe("the addresses of the games with friends", () => {
  it("opens the lobby with a game and a friend chosen", () => {
    expect(lobbyURL()).toBe("/games/lobby");
    expect(lobbyURL({ game: "duel", friend: "sara.ghazal" })).toBe("/games/lobby?game=duel&with=sara.ghazal");
    expect(parseLobby({ game: "duel", with: "sara.ghazal" })).toEqual({ game: "duel", friend: "sara.ghazal" });
    expect(parseLobby({ game: ["poet", "mosh"] })).toEqual({ game: "poet" });
  });

  it("drops what is not a game of the lobby or a username", () => {
    expect(parseLobby({ game: "daily", with: "../x" })).toEqual({});
    expect(parseLobby({ with: "9sara" })).toEqual({});
    expect(parseLobby({})).toEqual({});
  });

  it("names a game by its id and a challenge by its code", () => {
    expect(gameURL("mosh", "g1")).toBe("/games/mosh/g1");
    expect(challengeURL("7KQ2")).toBe("/c/7KQ2");
    expect(["g1", "new-duel", "6f1c2b9e-3a4d-4e8b-9c1d-0a2b3c4d5e6f"].every(isGameId)).toBe(true);
    expect(["", "a/b", "a b", "x".repeat(65)].some(isGameId)).toBe(false);
    expect(["7KQ2", "a1b2"].every(isChallengeCode)).toBe(true);
    expect(["7KQ", "7KQ22", "7K/2", ""].some(isChallengeCode)).toBe(false);
  });

  it("carries the friends a challenge goes to, five at most, only usernames", () => {
    expect(challengeRoundURL("jigsaw", [])).toBe("/games/jigsaw");
    expect(challengeRoundURL("poet", ["sara.ghazal", "kian_k"])).toBe("/games/poet?invite=sara.ghazal%2Ckian_k");
    expect(parseInvite("sara.ghazal,kian_k")).toEqual(["sara.ghazal", "kian_k"]);
    expect(parseInvite("a1,a2,a3,a4,a5,a6")).toHaveLength(5);
    expect(parseInvite("sara,../x,sara,,9")).toEqual(["sara"]);
    expect(parseInvite(undefined)).toEqual([]);
  });
});
