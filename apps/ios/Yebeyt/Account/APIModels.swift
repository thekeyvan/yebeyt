import Foundation

enum AuthProvider: String, Codable, Sendable {
    case apple, google
}

/// `User` of the contract.
struct APIUser: Codable, Equatable, Sendable {
    var id: String
    var username: String?
    var displayName: String?
    var usernameChangedAt: String?
    var createdAt: String
    var providers: [AuthProvider]
    /// The face; nil until the person saves one.
    var avatar: AvatarParts? = nil
}

/// `Divan` of the contract.
struct DivanState: Codable, Equatable, Sendable {
    var items: [DivanItem]
}

/// `Session` of the contract.
struct APISession: Codable, Equatable, Sendable {
    var accessToken: String
    var refreshToken: String
    var user: APIUser
}

/// `UsernameCheck`: `reason` is one of too_short, too_long, bad_chars, reserved, taken.
struct UsernameCheck: Codable, Equatable, Sendable {
    var available: Bool
    var reason: String?
}

/// `Progress`: what a guest carries over to the account.
struct ProgressPayload: Codable, Equatable, Sendable {
    var points: Int
    var streakDays: Int
    var streakLastDate: String?
    var bestByGame: [String: Int]

    // The contract wants the key even when the date is null.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(points, forKey: .points)
        try container.encode(streakDays, forKey: .streakDays)
        try container.encode(streakLastDate, forKey: .streakLastDate)
        try container.encode(bestByGame, forKey: .bestByGame)
    }
}

/// One entry of `GET /v1/poets/pictures`.
struct PoetPictureEntry: Codable, Equatable, Sendable {
    var slug: String
    var version: String
    /// A path on the server, to be resolved against its address.
    var url: String
}
