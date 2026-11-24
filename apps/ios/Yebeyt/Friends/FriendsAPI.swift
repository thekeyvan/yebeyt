import Foundation

/// The endpoints of friends, scores, reactions and the feed (see `packages/api/openapi.json`).
extension API {
    // MARK: Scores

    func postScore(_ request: ScoreRequest, token: String) async throws {
        try await send("POST", "/v1/scores", body: request, token: token)
    }

    func postDaily(_ request: DailyRequest, token: String) async throws {
        try await send("POST", "/v1/daily", body: request, token: token)
    }

    func stats(token: String) async throws -> RemoteStats {
        try await call("GET", "/v1/me/stats", token: token)
    }

    func dailyFriends(date: String, token: String) async throws -> DailyFriends {
        try await call("GET", "/v1/daily/\(date)/friends", token: token)
    }

    // MARK: Reactions

    /// The `#` of the couplet key is percent-encoded by the query items.
    func setReaction(_ kind: ReactionKind, key: String, on: Bool, token: String) async throws {
        try await send(on ? "PUT" : "DELETE", "/v1/reactions/\(kind.rawValue)", query: [URLQueryItem(name: "key", value: key)], token: token)
    }

    func myReactions(cursor: String?, token: String) async throws -> MyReactions {
        try await call("GET", "/v1/me/reactions", query: cursor.map { [URLQueryItem(name: "cursor", value: $0)] } ?? [], token: token)
    }

    // MARK: People

    func searchUsers(_ text: String, token: String) async throws -> [FoundPerson] {
        let found: UserSearch = try await call("GET", "/v1/users/search", query: [URLQueryItem(name: "q", value: text)], token: token)
        return found.items
    }

    func profile(username: String, token: String) async throws -> PublicProfile {
        try await call("GET", "/v1/users/\(username)", token: token)
    }

    func follow(_ username: String, on: Bool, token: String) async throws -> Relationship {
        try await call(on ? "PUT" : "DELETE", "/v1/follows/\(username)", token: token)
    }

    func friends(cursor: String?, token: String) async throws -> PeoplePage {
        try await call("GET", "/v1/me/friends", query: cursor.map { [URLQueryItem(name: "cursor", value: $0)] } ?? [], token: token)
    }

    func block(_ username: String, token: String) async throws {
        try await send("PUT", "/v1/blocks/\(username)", token: token)
    }

    func report(_ report: ReportRequest, token: String) async throws {
        try await send("POST", "/v1/reports", body: report, token: token)
    }

    // MARK: Leaderboard and feed

    func leagueStandings(token: String) async throws -> LeagueStandings {
        try await call("GET", "/v1/leaderboard/league", token: token)
    }

    func friendsStandings(token: String) async throws -> FriendsStandings {
        try await call("GET", "/v1/leaderboard/friends", token: token)
    }

    func globalStandings(cursor: String?, token: String) async throws -> GlobalStandings {
        try await call("GET", "/v1/leaderboard/global", query: cursor.map { [URLQueryItem(name: "cursor", value: $0)] } ?? [], token: token)
    }

    func feed(cursor: String?, token: String) async throws -> Feed {
        try await call("GET", "/v1/feed", query: cursor.map { [URLQueryItem(name: "cursor", value: $0)] } ?? [], token: token)
    }
}
