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
    /// The verified email of the newest sign-in method that has one (Apple's relay address counts); nil when none.
    var email: String? = nil
    /// Whether the person chose news by email; nil from a server that does not say.
    var newsOptIn: Bool? = nil
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

/// `FeedbackCreated`: the report's id and the token that lets the phone attach files to it for 15 minutes.
struct FeedbackCreated: Decodable, Equatable, Sendable {
    var id: String
    var uploadToken: String
}

/// A file that goes with a report: the screenshot (JPEG) or the recording (MP4).
enum FeedbackAttachment: Sendable {
    case screenshot, recording

    var path: String { self == .screenshot ? "screenshot" : "recording" }
    var contentType: String { self == .screenshot ? "image/jpeg" : "video/mp4" }
}
