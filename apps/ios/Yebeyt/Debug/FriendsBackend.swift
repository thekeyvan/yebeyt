#if DEBUG
import Foundation

/// What the fake server of `-beytSignedIn` answers for friends, friend requests, scores, reactions, the leaderboard and
/// the feed, so the screens can be seen without a network: friends (سارا, کیان, مهسا, and 74 more on two pages of the
/// friends list), two requests waiting for me (آرین, بردیا), one I sent (پریا), رها with nothing yet, a league of
/// eight, a feed of three items (30 on the first page and one more on a second). The requests and friendships move as on
/// the server (`Relations`); the friends list stays as it is, so the pages can be counted.
enum DebugFriendsBackend {
    /// Who I am a friend of, who asked me and whom I asked, in the order the server lists them (the requests newest first
    /// for the server; here the order they were made).
    final class Relations: @unchecked Sendable {
        private let lock = NSLock()
        private var friends: Set<String> = ["sara.ghazal", "kian_k", "mahsa.m"]
        private var received = ["aryan", "bardia"]
        private var sent = ["paria"]

        func state(of username: String) -> Friendship {
            lock.withLock {
                if friends.contains(username) { .friends } else if received.contains(username) { .incoming } else if sent.contains(username) { .requested } else { .none }
            }
        }

        var incoming: [String] { lock.withLock { received } }
        var outgoing: [String] { lock.withLock { sent } }
        var incomingCount: Int { lock.withLock { received.count } }

        /// Sends a request; one they sent me is accepted instead. Answers the state.
        func send(_ username: String) -> Friendship {
            lock.withLock {
                if friends.contains(username) { return .friends }
                if let index = received.firstIndex(of: username) {
                    received.remove(at: index)
                    friends.insert(username)
                    return .friends
                }
                if !sent.contains(username) { sent.append(username) }
                return .requested
            }
        }

        func cancel(_ username: String) { lock.withLock { sent.removeAll { $0 == username } } }

        func accept(_ username: String) {
            lock.withLock {
                received.removeAll { $0 == username }
                friends.insert(username)
            }
        }

        func reject(_ username: String) { lock.withLock { received.removeAll { $0 == username } } }

        func unfriend(_ username: String) { lock.withLock { _ = friends.remove(username) } }
    }

    /// The one the launched app answers from.
    static let shared = Relations()

    /// The requests waiting for me, for the unread answer.
    static var incomingCount: Int { shared.incomingCount }

    /// How many pages the screens have asked for, so a UI test can see that a list loads one page at a time: «my»
    /// friends count (`/v1/users/niloofar`) is the friends pages served plus 100 for each page of the feed after the first.
    private final class Served: @unchecked Sendable {
        private let lock = NSLock()
        private var friends = 0
        private var feed = 0
        func friendsPage() { lock.withLock { friends += 1 } }
        func feedPage() { lock.withLock { feed += 1 } }
        var friendsCount: Int { lock.withLock { friends + 100 * feed } }
    }

    private static let served = Served()

    private static func face(_ skin: String, _ hair: String, _ background: String) -> String {
        #"{"face":"\#(skin)","eyes":"round","hair":"\#(hair)","mouth":"smile","accessory":"none","background":"\#(background)"}"#
    }

    private static let sara = #"{"username":"sara.ghazal","displayName":"سارا","avatar":\#(face("peach", "dark", "rose"))}"#
    private static let kian = #"{"username":"kian_k","displayName":"کیان","avatar":\#(face("sand", "fire", "sun"))}"#
    private static let mahsa = #"{"username":"mahsa.m","displayName":"مهسا","avatar":\#(face("tan", "black", "lapis"))}"#
    private static let aryan = #"{"username":"aryan","displayName":"آرین","avatar":\#(face("sand", "black", "mint"))}"#
    private static let bardia = #"{"username":"bardia","displayName":"بردیا","avatar":\#(face("peach", "amber", "sun"))}"#
    private static let paria = #"{"username":"paria","displayName":"پریا","avatar":\#(face("tan", "dark", "mint"))}"#
    private static let raha = #"{"username":"raha","displayName":"رها","avatar":\#(face("ivory", "lapis", "sky"))}"#
    /// The demo friend: in the friends list and the search like anyone, but it can't play.
    private static let house = #"{"username":"yebeyt","displayName":"یه بیت","avatar":null,"canPlay":false}"#
    private static let everyone = [sara, kian, mahsa, aryan, bardia, paria, raha, house]

    private static func person(_ username: String) -> String {
        everyone.first { $0.contains("\"\(username)\"") } ?? sara
    }

    private static func found(_ person: String, _ state: Friendship) -> String {
        String(person.dropLast()) + #","friendship":"\#(state.rawValue)","isFriend":\#(state == .friends)}"#
    }

    private static func usernameOf(_ path: String, after prefix: String) -> String {
        String(path.dropFirst(prefix.count).prefix { $0 != "/" })
    }

    /// The requests of one direction, as the server pages them (one page).
    private static func requests(_ usernames: [String], now: Date) -> String {
        let items = usernames.enumerated().map { index, username in
            String(person(username).dropLast()) + #","createdAt":"\#(iso(now.addingTimeInterval(-Double(index + 1) * 3600)))"}"#
        }
        return #"{"items":[\#(items.joined(separator: ","))],"nextCursor":null}"#
    }

    private static func iso(_ date: Date) -> String { ServerTime.string(from: date) }

    /// nil for a request this part doesn't know.
    static func answer(method: String, path: String, query: String, now: Date = .now, relations: Relations = shared) -> (Int, String)? {
        switch (method, path) {
        case ("GET", "/v1/users/search"):
            (200, #"{"items":[\#(["yebeyt", "sara.ghazal", "kian_k", "mahsa.m", "aryan", "paria", "raha"].map { found(person($0), relations.state(of: $0)) }.joined(separator: ","))]}"#)
        case ("POST", let path) where path.hasPrefix("/v1/friend-requests/") && path.hasSuffix("/accept"):
            (200, { relations.accept(usernameOf(path, after: "/v1/friend-requests/")); return #"{"friendship":"friends"}"# }())
        case ("POST", let path) where path.hasPrefix("/v1/friend-requests/") && path.hasSuffix("/reject"):
            (204, { relations.reject(usernameOf(path, after: "/v1/friend-requests/")); return "" }())
        case ("POST", let path) where path.hasPrefix("/v1/friend-requests/"):
            (200, #"{"friendship":"\#(relations.send(usernameOf(path, after: "/v1/friend-requests/")).rawValue)"}"#)
        case ("DELETE", let path) where path.hasPrefix("/v1/friend-requests/"):
            (204, { relations.cancel(usernameOf(path, after: "/v1/friend-requests/")); return "" }())
        case ("DELETE", let path) where path.hasPrefix("/v1/friends/"):
            (204, { relations.unfriend(usernameOf(path, after: "/v1/friends/")); return "" }())
        case ("GET", "/v1/me/friend-requests"):
            (200, requests(query.contains("outgoing") ? relations.outgoing : relations.incoming, now: now))
        case ("GET", let path) where path.hasPrefix("/v1/users/"):
            (200, profile(username: String(path.dropFirst("/v1/users/".count)), relations: relations))
        case ("GET", "/v1/me/friends"):
            (200, { served.friendsPage(); return friends(query: query) }())
        case ("GET", "/v1/reactions/counts"):
            (200, counts(query: query))
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
            (200, { if query.contains("cursor=2") { served.feedPage() }; return feed(query: query, now: now) }())
        default:
            nil
        }
    }

    /// A person's page: kian is a friend, so «پیام بده» shows on his page; رها has nothing, آرین asked me, پریا I asked.
    private static func profile(username: String, relations: Relations) -> String {
        let state = relations.state(of: username)
        let count = username == "niloofar" ? served.friendsCount : 12
        return String(person(username).dropLast())
            + #","friendsCount":\#(count),"friendship":"\#(state.rawValue)","isFriend":\#(state == .friends),"canMessage":\#(state == .friends),"league":{"tier":2},"weekPoints":2640}"#
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

    /// The friends list: «یه بیت», the three, then generated people, 40 a page; `cursor=2` is the second page.
    private static func friends(query: String) -> String {
        let second = query.contains("cursor=2")
        let named = second ? [] : [house, sara, kian, mahsa]
        let range = second ? 38...77 : 1...37
        let generated = range.map { n in
            #"{"username":"friend\#(String(format: "%02d", n))","displayName":"دوست \#(PersianDigits.string(n))","avatar":\#(face("sand", "dark", "sky"))}"#
        }
        return #"{"items":[\#((named + generated).joined(separator: ","))],"nextCursor":\#(second ? "null" : #""2""#)}"#
    }

    /// Counts for the keys asked (`keys=a,b` with the `#` percent-encoded): 4 likes and 2 reposts each, none mine.
    private static func counts(query: String) -> String {
        let keys = query.replacingOccurrences(of: "keys=", with: "").replacingOccurrences(of: "%23", with: "#").split(separator: ",").map(String.init)
        let entries = keys.map { #""\#($0)":{"likes":4,"reposts":2,"likedByMe":false,"repostedByMe":false}"# }
        return "{\(entries.joined(separator: ","))}"
    }

    private static func feed(query: String, now: Date) -> String {
        let today = TehranDay(date: now).key
        func daily(_ user: String, minutes: Double) -> String {
            #"{"type":"daily","user":\#(user),"date":"\#(today)","tries":2,"at":"\#(iso(now.addingTimeInterval(-minutes * 60)))"}"#
        }
        if query.contains("cursor=2") {
            let last = #"{"username":"zed_last","displayName":"زد","avatar":null}"#
            return #"{"items":[\#(daily(last, minutes: 3000))],"nextCursor":null}"#
        }
        let fillers = (1...27).map { daily(#"{"username":"fill\#($0)","displayName":"پر \#(PersianDigits.string($0))","avatar":null}"#, minutes: Double(200 + $0)) }
        let items = [
            #"{"type":"repost","user":\#(kian),"key":"/hafez/ghazal/sh3#0","at":"\#(iso(now.addingTimeInterval(-3600)))"}"#,
            daily(sara, minutes: 10),
            #"{"type":"like","user":\#(mahsa),"key":"/hafez/ghazal/sh1#2","at":"\#(iso(now.addingTimeInterval(-7200)))"}"#,
        ] + fillers
        return #"{"items":[\#(items.joined(separator: ","))],"nextCursor":"2"}"#
    }
}
#endif
