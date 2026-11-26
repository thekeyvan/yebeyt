import type { Call } from "../account/api";
import { resultOf, type FriendAction } from "./friendship";
import type { Feed, FriendRequestsPage, FriendsPage, FriendsStandings, Friendship, GlobalStandings, LeagueStandings, PublicProfile, ReactionCounts, ReportRequest, Unread, FoundPerson } from "./models";

export type FriendRequestDirection = "incoming" | "outgoing";

const at = (username: string): string => encodeURIComponent(username);
const paged = (cursor: string | undefined, extra: Record<string, string> = {}) => ({ query: { ...extra, ...(cursor === undefined ? {} : { cursor }) } });

/** The calls of friends, friend requests, blocking, reports, the leaderboard and the feed (Friends/FriendsAPI.swift), through the web app's door. */
export function friendsApi(call: Call) {
  return {
    searchUsers: async (q: string) => (await call<{ items: FoundPerson[] }>("GET", "/v1/users/search", { query: { q } })).items,
    profile: (username: string) => call<PublicProfile>("GET", `/v1/users/${at(username)}`),
    /** Does `action` to the friendship with `username` and answers the state it ended in (a request they had already sent is accepted by sending one: the answer says `friends`). */
    async friendAction(action: FriendAction, username: string): Promise<Friendship> {
      switch (action) {
        case "send":
          return (await call<{ friendship: Friendship }>("POST", `/v1/friend-requests/${at(username)}`)).friendship;
        case "accept":
          return (await call<{ friendship: Friendship }>("POST", `/v1/friend-requests/${at(username)}/accept`)).friendship;
        case "cancel":
          await call("DELETE", `/v1/friend-requests/${at(username)}`);
          break;
        case "reject":
          await call("POST", `/v1/friend-requests/${at(username)}/reject`);
          break;
        case "unfriend":
          await call("DELETE", `/v1/friends/${at(username)}`);
          break;
      }
      return resultOf(action);
    },
    friends: (cursor?: string) => call<FriendsPage>("GET", "/v1/me/friends", paged(cursor)),
    friendRequests: (direction: FriendRequestDirection, cursor?: string) => call<FriendRequestsPage>("GET", "/v1/me/friend-requests", paged(cursor, { direction })),
    block: (username: string) => call<void>("PUT", `/v1/blocks/${at(username)}`),
    report: (request: ReportRequest) => call<void>("POST", "/v1/reports", { body: request }),
    unread: () => call<Unread>("GET", "/v1/me/unread"),
    leagueStandings: () => call<LeagueStandings>("GET", "/v1/leaderboard/league"),
    friendsStandings: () => call<FriendsStandings>("GET", "/v1/leaderboard/friends"),
    globalStandings: (cursor?: string) => call<GlobalStandings>("GET", "/v1/leaderboard/global", paged(cursor)),
    feed: (cursor?: string) => call<Feed>("GET", "/v1/feed", paged(cursor)),
    /** Counts of up to 50 couplets (the keys go comma separated). */
    reactionCounts: (keys: readonly string[]) => call<Record<string, ReactionCounts>>("GET", "/v1/reactions/counts", { query: { keys: keys.join(",") } }),
  };
}
