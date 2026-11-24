#if DEBUG
import Foundation

/// What the fake server of `-beytSignedIn` answers for friends, scores, reactions, the leaderboard and the feed, so the
/// screens can be seen without a network: three friends (سارا, کیان, مهسا), a league of eight, a feed of three items.
enum DebugFriendsBackend {
    private static func face(_ skin: String, _ hair: String, _ background: String) -> String {
        #"{"face":"\#(skin)","eyes":"round","hair":"\#(hair)","mouth":"smile","accessory":"none","background":"\#(background)"}"#
    }

    private static let sara = #"{"username":"sara.ghazal","displayName":"سارا","avatar":\#(face("peach", "dark", "rose"))}"#
    private static let kian = #"{"username":"kian_k","displayName":"کیان","avatar":\#(face("sand", "fire", "sun"))}"#
    private static let mahsa = #"{"username":"mahsa.m","displayName":"مهسا","avatar":\#(face("tan", "black", "lapis"))}"#

    private static func found(_ person: String, following: Bool) -> String {
        String(person.dropLast()) + #","isFollowing":\#(following),"isFriend":false}"#
    }

    private static func iso(_ date: Date) -> String { ServerTime.string(from: date) }

    /// nil for a request this part doesn't know.
    static func answer(method: String, path: String, query: String, now: Date = .now) -> (Int, String)? {
        switch (method, path) {
        case ("GET", "/v1/users/search"):
            (200, #"{"items":[\#(found(sara, following: true)),\#(found(kian, following: false)),\#(found(mahsa, following: false))]}"#)
        case ("PUT", let path) where path.hasPrefix("/v1/follows/"):
            (200, #"{"isFollowing":true,"followsYou":false,"isFriend":false}"#)
        case ("DELETE", let path) where path.hasPrefix("/v1/follows/"):
            (200, #"{"isFollowing":false,"followsYou":false,"isFriend":false}"#)
        case ("GET", let path) where path.hasPrefix("/v1/users/"):
            (200, profile(username: String(path.dropFirst("/v1/users/".count))))
        case ("GET", "/v1/me/friends"):
            (200, #"{"items":[\#(friend(sara)),\#(friend(kian)),\#(friend(mahsa))],"nextCursor":null}"#)
        case ("PUT", let path) where path.hasPrefix("/v1/blocks/"):
            (204, "")
        case ("POST", "/v1/reports"):
            (204, "")
        case ("GET", "/v1/me/stats"):
            (200, #"{"totalPoints":2480,"weekPoints":2480,"streakDays":7,"league":{"tier":2}}"#)
        case ("POST", "/v1/scores"), ("POST", "/v1/daily"):
            (200, #"{"week":"2026-W47","weekPoints":2480}"#)
        case ("GET", let path) where path.hasPrefix("/v1/daily/") && path.hasSuffix("/friends"):
            (200, #"{"solvedCount":3,"friends":[]}"#)
        case ("PUT", let path) where path.hasPrefix("/v1/reactions/"), ("DELETE", let path) where path.hasPrefix("/v1/reactions/"):
            (200, #"{"likes":1,"reposts":0,"likedByMe":true,"repostedByMe":false}"#)
        case ("GET", "/v1/me/reactions"):
            (200, #"{"items":[],"nextCursor":null}"#)
        case ("GET", "/v1/leaderboard/league"):
            (200, league(now: now))
        case ("GET", "/v1/leaderboard/friends"):
            (200, #"{"week":"2026-W47","rows":[\#(row(1, sara, 2640)),\#(row(2, nil, 2480, me: true)),\#(row(3, kian, 2310)),\#(row(4, mahsa, 2090))]}"#)
        case ("GET", "/v1/leaderboard/global"):
            (200, #"{"week":"2026-W47","rows":[\#(row(1, sara, 9120)),\#(row(2, kian, 8800)),\#(row(3, mahsa, 8410))],"me":\#(row(42, nil, 2480, me: true)),"nextCursor":null}"#)
        case ("GET", "/v1/feed"):
            (200, feed(now: now))
        default:
            nil
        }
    }

    private static func friend(_ person: String) -> String { String(person.dropLast()) + #","isFriend":true}"# }

    private static func profile(username: String) -> String {
        let person = [sara, kian, mahsa].first { $0.contains("\"\(username)\"") } ?? sara
        return String(person.dropLast()) + #","friendsCount":12,"isFollowing":false,"followsYou":true,"isFriend":false,"league":{"tier":2},"weekPoints":2640}"#
    }

    private static func row(_ rank: Int, _ person: String?, _ points: Int, me: Bool = false) -> String {
        let who = person ?? #"{"username":"niloofar","displayName":null,"avatar":\#(face("peach", "dark", "sun"))}"#
        let body = String(who.dropFirst().dropLast())
        return #"{"rank":\#(rank),\#(body),"points":\#(points),"isMe":\#(me),"hidden":false}"#
    }

    /// The board's league: eight people, me third, a hidden stranger last.
    private static func league(now: Date) -> String {
        let aryan = #"{"username":"aryan","displayName":"آرین","avatar":\#(face("sand", "black", "mint"))}"#
        let bardia = #"{"username":"bardia","displayName":"بردیا","avatar":\#(face("peach", "amber", "sun"))}"#
        let paria = #"{"username":"paria","displayName":"پریا","avatar":\#(face("tan", "dark", "mint"))}"#
        let raha = #"{"username":"raha","displayName":"رها","avatar":\#(face("ivory", "lapis", "sky"))}"#
        let rows = [
            row(1, aryan, 2910), row(2, sara, 2640), row(3, nil, 2480, me: true), row(4, kian, 2310), row(5, mahsa, 2090),
            row(6, bardia, 1950), row(7, paria, 1720), row(8, raha, 1610),
            #"{"rank":9,"username":null,"displayName":null,"avatar":null,"points":1500,"isMe":false,"hidden":true}"#,
        ]
        return #"{"week":"2026-W47","tier":2,"endsAt":"\#(iso(now.addingTimeInterval(2.6 * 86_400)))","rows":[\#(rows.joined(separator: ","))],"promoteCount":5,"demoteCount":5}"#
    }

    private static func feed(now: Date) -> String {
        let items = [
            #"{"type":"repost","user":\#(kian),"key":"/hafez/ghazal/sh3#0","at":"\#(iso(now.addingTimeInterval(-3600)))"}"#,
            #"{"type":"daily","user":\#(sara),"date":"2026-11-24","tries":3,"at":"\#(iso(now.addingTimeInterval(-600)))"}"#,
            #"{"type":"like","user":\#(mahsa),"key":"/hafez/ghazal/sh1#2","at":"\#(iso(now.addingTimeInterval(-7200)))"}"#,
        ]
        return #"{"items":[\#(items.joined(separator: ","))],"nextCursor":null}"#
    }
}
#endif
