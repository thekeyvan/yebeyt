import Foundation

/// The shapes of friends, the leaderboard, the feed, scores and reactions in `packages/api/openapi.json`.

/// `PersonShort`: someone as a row shows them.
struct PersonShort: Codable, Equatable, Sendable {
    var username: String
    var displayName: String?
    var avatar: AvatarParts?

    /// What a row calls them: the name, else the username.
    var name: String { displayName ?? username }
}

/// `FoundPerson` (search) and `Person` (a friends page): `isFollowing` is only in a search answer, a friend is always followed.
struct FoundPerson: Codable, Equatable, Sendable {
    var username: String
    var displayName: String?
    var avatar: AvatarParts?
    var isFollowing: Bool?
    var isFriend: Bool

    var short: PersonShort { PersonShort(username: username, displayName: displayName, avatar: avatar) }
    var followed: Bool { isFollowing ?? true }
}

/// `UserSearch`.
struct UserSearch: Codable, Sendable {
    var items: [FoundPerson]
}

/// `PeoplePage`, `nextCursor` is nil on the last page.
struct PeoplePage: Codable, Sendable {
    var items: [FoundPerson]
    var nextCursor: String?
}

/// `Relationship`: how I and another person follow each other.
struct Relationship: Codable, Equatable, Sendable {
    var isFollowing: Bool
    var followsYou: Bool
    var isFriend: Bool
}

/// `PublicProfile`.
struct PublicProfile: Codable, Equatable, Sendable {
    struct League: Codable, Equatable, Sendable { var tier: Int }

    var username: String
    var displayName: String?
    var avatar: AvatarParts?
    var friendsCount: Int
    var isFollowing: Bool
    var followsYou: Bool
    var isFriend: Bool
    var league: League?
    var weekPoints: Int?

    var short: PersonShort { PersonShort(username: username, displayName: displayName, avatar: avatar) }
    var relation: Relationship { Relationship(isFollowing: isFollowing, followsYou: followsYou, isFriend: isFriend) }
}

/// `LeaderboardRow`. A `hidden` row is a stranger who keeps off the global list: no name, no face.
struct LeaderboardRow: Codable, Equatable, Identifiable, Sendable {
    var rank: Int
    var username: String?
    var displayName: String?
    var avatar: AvatarParts?
    var points: Int
    var isMe: Bool
    var hidden: Bool

    var id: Int { rank }
}

/// `LeagueStandings`.
struct LeagueStandings: Codable, Equatable, Sendable {
    var week: String
    var tier: Int
    var endsAt: String
    var rows: [LeaderboardRow]
    var promoteCount: Int
    var demoteCount: Int
}

/// `FriendsStandings`.
struct FriendsStandings: Codable, Equatable, Sendable {
    var week: String
    var rows: [LeaderboardRow]
}

/// `GlobalStandings`; `me` is my own rank, also when I am not on the list.
struct GlobalStandings: Codable, Equatable, Sendable {
    var week: String
    var rows: [LeaderboardRow]
    var me: LeaderboardRow?
    var nextCursor: String?
}

/// `FeedItem`.
struct FeedItem: Codable, Equatable, Sendable {
    enum Kind: String, Codable, Sendable { case like, repost, daily }

    var type: Kind
    var user: PersonShort
    /// The couplet, for a like or a repost.
    var key: String?
    /// The Tehran day, for a daily result.
    var date: String?
    var tries: Int?
    var at: String
}

/// `Feed`.
struct Feed: Codable, Sendable {
    var items: [FeedItem]
    var nextCursor: String?
}

/// `Stats`: my points, streak and league.
struct RemoteStats: Codable, Equatable, Sendable {
    struct League: Codable, Equatable, Sendable { var tier: Int }

    var totalPoints: Int
    var weekPoints: Int
    var streakDays: Int
    var league: League
}

/// `DailyFriends`: how my friends did in a day's puzzle.
struct DailyFriends: Codable, Equatable, Sendable {
    var solvedCount: Int
}

enum ReactionKind: String, Codable, CaseIterable, Sendable {
    case like, repost
}

/// `MyReactions`.
struct MyReactions: Codable, Sendable {
    struct Item: Codable, Equatable, Sendable {
        var key: String
        var kind: ReactionKind
        var at: String
    }

    var items: [Item]
    var nextCursor: String?
}

/// `ScoreRequest`.
struct ScoreRequest: Codable, Equatable, Sendable {
    var roundId: String
    var game: ScoreGame
    var points: Int
    var playedAt: String
}

/// `DailyRequest`.
struct DailyRequest: Codable, Equatable, Sendable {
    var date: String
    var solved: Bool
    var tries: Int
}

/// `ReportRequest` for a person.
struct ReportRequest: Codable, Sendable {
    enum Reason: String, Codable, Sendable { case spam, abuse, other }

    var username: String
    var reason: Reason
    var note: String?
}

/// The server's times: ISO 8601 with milliseconds.
enum ServerTime {
    private static let style = Date.ISO8601FormatStyle(includingFractionalSeconds: true)

    static func string(from date: Date) -> String {
        date.formatted(style)
    }

    static func date(from text: String) -> Date? {
        try? style.parse(text)
    }
}
