import Foundation

// The games-with-friends part of the contract (`packages/api/openapi.json`): games, their players, couplets and
// rounds, and challenges.

/// `GamePlayer`.
struct GamePlayer: Equatable, Sendable, Decodable {
    var username: String
    var displayName: String?
    var avatar: AvatarParts?
    var seat: Int
    var score: Int

    init(username: String, displayName: String? = nil, avatar: AvatarParts? = nil, seat: Int, score: Int = 0) {
        self.username = username
        self.displayName = displayName
        self.avatar = avatar
        self.seat = seat
        self.score = score
    }

    /// The name shown: the display name, else the username.
    var name: String {
        guard let displayName, !displayName.trimmingCharacters(in: .whitespaces).isEmpty else { return username }
        return displayName
    }
}

/// `GameTurn`: whose turn it is and when it runs out.
struct GameTurn: Equatable, Sendable, Decodable {
    var username: String
    var deadline: Date

    init(username: String, deadline: Date) {
        self.username = username
        self.deadline = deadline
    }

    private enum CodingKeys: String, CodingKey { case username, deadline }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        username = try values.decode(String.self, forKey: .username)
        deadline = try values.decode(APIDate.self, forKey: .deadline).date
    }
}

/// `MoshMove`: one couplet played in مشاعره.
struct MoshMove: Equatable, Identifiable, Sendable, Decodable {
    var n: Int
    var username: String?
    var key: String
    var m1: String
    var m2: String
    var createdAt: Date

    var id: Int { n }

    init(n: Int, username: String?, key: String, m1: String, m2: String, createdAt: Date) {
        self.n = n
        self.username = username
        self.key = key
        self.m1 = m1
        self.m2 = m2
        self.createdAt = createdAt
    }

    private enum CodingKeys: String, CodingKey { case n, username, key, m1, m2, createdAt }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        n = try values.decode(Int.self, forKey: .n)
        username = try values.decodeIfPresent(String.self, forKey: .username)
        key = try values.decode(String.self, forKey: .key)
        m1 = try values.decode(String.self, forKey: .m1)
        m2 = try values.decode(String.self, forKey: .m2)
        createdAt = try values.decode(APIDate.self, forKey: .createdAt).date
    }
}

/// The three kinds of question in رودررو: مصراع دوم, حدس شاعر, از کدوم کتاب؟
enum DuelKind: String, Sendable, Decodable {
    case second, poet, book

    var title: String {
        switch self {
        case .second: "مصراع دوم"
        case .poet: "حدس شاعر"
        case .book: "از کدوم کتاب؟"
        }
    }
}

/// `DuelRoundResult`: a round of a finished رودررو, with the couplet and its meaning. `poet` is the poet's slug.
struct DuelResult: Equatable, Sendable, Decodable {
    var round: Int
    var type: DuelKind
    var key: String
    var m1: String
    var m2: String
    var meaning: String
    var poet: String
    var bookTitle: String
    var winner: String?
}

/// `Game` (and `GameSummary`, which has no moves or rounds).
struct FriendGame: Equatable, Identifiable, Sendable, Decodable {
    enum Kind: String, Sendable, Decodable { case mosh, duel }
    enum Status: String, Sendable, Decodable { case waiting, active, done }
    enum EndReason: String, Sendable, Decodable { case timeout, resigned, left, finished, expired }

    var id: String
    var kind: Kind
    var turnSeconds: Int
    var status: Status
    var code: String
    var createdAt: Date
    var endedAt: Date?
    var winner: String?
    var endReason: EndReason?
    var players: [GamePlayer]
    var turn: GameTurn?
    var moves: [MoshMove]
    var rounds: [DuelResult]

    init(
        id: String, kind: Kind, turnSeconds: Int, status: Status, code: String = "ABCD", createdAt: Date = .now, endedAt: Date? = nil,
        winner: String? = nil, endReason: EndReason? = nil, players: [GamePlayer], turn: GameTurn? = nil, moves: [MoshMove] = [], rounds: [DuelResult] = []
    ) {
        self.id = id
        self.kind = kind
        self.turnSeconds = turnSeconds
        self.status = status
        self.code = code
        self.createdAt = createdAt
        self.endedAt = endedAt
        self.winner = winner
        self.endReason = endReason
        self.players = players
        self.turn = turn
        self.moves = moves
        self.rounds = rounds
    }

    private enum CodingKeys: String, CodingKey {
        case id, kind, turnSeconds, status, code, createdAt, endedAt, winner, endReason, players, turn, moves, rounds
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        kind = try values.decode(Kind.self, forKey: .kind)
        turnSeconds = try values.decode(Int.self, forKey: .turnSeconds)
        status = try values.decode(Status.self, forKey: .status)
        code = try values.decode(String.self, forKey: .code)
        createdAt = try values.decode(APIDate.self, forKey: .createdAt).date
        endedAt = try values.decodeIfPresent(APIDate.self, forKey: .endedAt)?.date
        winner = try values.decodeIfPresent(String.self, forKey: .winner)
        endReason = try values.decodeIfPresent(EndReason.self, forKey: .endReason)
        players = try values.decode([GamePlayer].self, forKey: .players)
        turn = try values.decodeIfPresent(GameTurn.self, forKey: .turn)
        moves = try values.decodeIfPresent([MoshMove].self, forKey: .moves) ?? []
        rounds = try values.decodeIfPresent([DuelResult].self, forKey: .rounds) ?? []
    }

    func player(_ username: String) -> GamePlayer? { players.first { $0.username == username } }

    /// The other player, nil while nobody has joined.
    func other(than username: String) -> GamePlayer? { players.first { $0.username != username } }
}

/// `GameCreated`: the game, who got the invitation and who was skipped.
struct GameCreated: Equatable, Sendable, Decodable {
    struct Skipped: Equatable, Sendable, Decodable {
        var username: String
        var reason: String
    }

    var game: FriendGame
    var invited: [String]
    var skipped: [Skipped]
}

/// The two games that are challenges: the same ten couplets for each player.
enum ChallengeGame: String, Sendable, Codable {
    case jigsaw, poet

    var kind: GameKind { self == .jigsaw ? .jigsaw : .poet }

    /// «جورچین بیت», «حدس شاعر».
    var name: String { kind.name }
}

/// `Challenge`: what a link opens.
struct Challenge: Equatable, Sendable, Decodable {
    var creator: PersonShort
    var game: ChallengeGame
    var items: [String]
    var score: Int
    var seconds: Int
    /// «۱۰ بیت سعدی» when all ten are by one poet.
    var label: String?
}

/// `ChallengeCreated`.
struct ChallengeCreated: Equatable, Sendable, Decodable {
    var code: String
    var url: String
}

/// The result inside a live `challenge.result` event.
struct ChallengeLiveResult: Equatable, Sendable, Decodable {
    var name: String
    var username: String?
    var score: Int
    var seconds: Int
}
