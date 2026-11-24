import Foundation

/// The endpoints of games with friends and challenges (see `packages/api/openapi.json`).
extension API {
    /// Makes a game that waits for a second player and sends the invitations. مشاعره needs `turnSeconds` (30, 120 or
    /// 86400); رودررو leaves it out.
    func createGame(kind: FriendGame.Kind, turnSeconds: Int?, invite: [String], token: String) async throws -> GameCreated {
        struct Body: Encodable { var kind: String; var turnSeconds: Int?; var invite: [String] }
        return try await call("POST", "/v1/games", body: Body(kind: kind.rawValue, turnSeconds: turnSeconds, invite: invite), token: token)
    }

    /// Takes the free seat of a waiting game, by its id (always by id from an invitation, never by an old code).
    func joinGame(id: String, token: String) async throws -> FriendGame {
        try await call("POST", "/v1/games/\(id)/join", token: token)
    }

    func game(id: String, token: String) async throws -> FriendGame {
        try await call("GET", "/v1/games/\(id)", token: token)
    }

    /// Waiting and active games and the ones that ended in the last week, newest first, without couplets or rounds.
    func myGames(token: String) async throws -> [FriendGame] {
        struct List: Decodable { var items: [FriendGame] }
        let list: List = try await call("GET", "/v1/me/games", token: token)
        return list.items
    }

    func playMove(gameId: String, key: String, m1: String, m2: String, token: String) async throws -> FriendGame {
        struct Body: Encodable { var key: String; var m1: String; var m2: String }
        return try await call("POST", "/v1/games/\(gameId)/moves", body: Body(key: key, m1: m1, m2: m2), token: token)
    }

    /// «کم آوردم».
    func resign(gameId: String, token: String) async throws -> FriendGame {
        try await call("POST", "/v1/games/\(gameId)/resign", token: token)
    }

    // MARK: Challenges

    func createChallenge(game: ChallengeGame, items: [String], score: Int, seconds: Int, token: String) async throws -> ChallengeCreated {
        struct Body: Encodable { var game: String; var items: [String]; var score: Int; var seconds: Int }
        return try await call("POST", "/v1/challenges", body: Body(game: game.rawValue, items: items, score: score, seconds: seconds), token: token)
    }

    /// No account needed.
    func challenge(code: String) async throws -> Challenge {
        try await call("GET", "/v1/challenges/\(code)")
    }

    /// Leaves a result. Without a `token` the `name` is required (a guest).
    func postChallengeResult(code: String, score: Int, seconds: Int, name: String?, token: String?) async throws {
        struct Body: Encodable { var score: Int; var seconds: Int; var name: String? }
        let _: ChallengeResultSaved = try await call("POST", "/v1/challenges/\(code)/results", body: Body(score: score, seconds: seconds, name: name), token: token)
    }

    private struct ChallengeResultSaved: Decodable { var id: String }
}
