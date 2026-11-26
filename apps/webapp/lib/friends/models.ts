import type { components } from "../api/schema";

// The shapes of friends, the leaderboard, the feed and reactions in `packages/api/openapi.json` (Friends/FriendModels.swift).
type Schemas = components["schemas"];

export type Friendship = Schemas["Friendship"];
export type PersonShort = Schemas["PersonShort"];
/** Search: someone with where I stand with them. `canPlay` is false only for the demo friend «یه بیت». */
export type FoundPerson = Schemas["FoundPerson"];
export type FriendsPage = Schemas["FriendsPage"];
export type FriendRequest = Schemas["FriendRequestsPage"]["items"][number];
export type FriendRequestsPage = Schemas["FriendRequestsPage"];
export type Unread = Schemas["Unread"];
export type PublicProfile = Schemas["PublicProfile"];
export type LeaderboardRow = Schemas["LeaderboardRow"];
export type LeagueStandings = Schemas["LeagueStandings"];
export type FriendsStandings = Schemas["FriendsStandings"];
/** `me` is my own rank, also when I am not on the list. */
export type GlobalStandings = Omit<Schemas["GlobalStandings"], "me"> & { me: LeaderboardRow | null };
export type FeedItem = Schemas["FeedItem"];
export type Feed = Schemas["Feed"];
export type ReactionCounts = Schemas["ReactionCounts"];
export type ReportRequest = Schemas["ReportRequest"];

/** Where a screen's first load stands. */
export type Phase = { kind: "loading" | "loaded" } | { kind: "failed"; message: string };

export const loading: Phase = { kind: "loading" };
export const loaded: Phase = { kind: "loaded" };

/** What a row calls someone: the name, else the username. */
export const nameOf = (person: Pick<PersonShort, "username" | "displayName">): string => person.displayName ?? person.username;

/** The short person of a search result, a request or a profile. */
export const shortOf = ({ username, displayName, avatar }: PersonShort): PersonShort => ({ username, displayName, avatar });
