import Foundation

/// What a row of the leaderboard shows, worked out from the server's row.
struct LeaderboardEntry: Equatable, Identifiable, Sendable {
    enum Medal: Sendable { case gold, silver, bronze }

    var rank: Int
    /// «تو» for my own row, «یه نفر» for a hidden stranger, else the name.
    var name: String
    var username: String?
    var avatar: AvatarParts?
    /// A hidden stranger has no face: the row draws a plain circle.
    var isHidden: Bool
    var isMe: Bool
    var points: String
    var medal: Medal?

    var id: Int { rank }
    var rankText: String { PersianDigits.string(rank) }

    init(_ row: LeaderboardRow) {
        rank = row.rank
        isMe = row.isMe
        isHidden = row.hidden
        username = row.hidden ? nil : row.username
        avatar = row.hidden ? nil : row.avatar
        name = row.isMe ? "تو" : row.hidden ? "یه نفر" : row.displayName ?? row.username ?? "یه نفر"
        points = PersianDigits.grouped(row.points)
        medal = switch row.rank {
        case 1: .gold
        case 2: .silver
        case 3: .bronze
        default: nil
        }
    }

    /// Someone whose page can be opened: not me, not hidden, with a username.
    var opensPerson: String? { isMe || isHidden ? nil : username }
}

/// A line of the list: a row, the green «این ۵ نفر می‌رن لیگ بالاتر» band between the ranks that move up and the rest, or
/// a «…» for the ranks left out between the list and my own row.
enum LeaderboardItem: Equatable, Identifiable, Sendable {
    case entry(LeaderboardEntry)
    case promoteBand(Int)
    case gap

    var id: String {
        switch self {
        case .entry(let entry): "row-\(entry.rank)"
        case .promoteBand: "band"
        case .gap: "gap"
        }
    }
}

enum LeaderboardLayout {
    /// The league's rows, with the band after the first `promoteCount` (not drawn when nobody is below them).
    static func league(_ standings: LeagueStandings) -> [LeaderboardItem] {
        var items: [LeaderboardItem] = []
        for (index, row) in standings.rows.enumerated() {
            if index == standings.promoteCount, standings.promoteCount > 0 { items.append(.promoteBand(standings.promoteCount)) }
            items.append(.entry(LeaderboardEntry(row)))
        }
        return items
    }

    static func friends(_ standings: FriendsStandings) -> [LeaderboardItem] {
        standings.rows.map { .entry(LeaderboardEntry($0)) }
    }

    /// The friends tab has nothing to show but me when I have no friends yet.
    static func hasNoFriends(_ standings: FriendsStandings) -> Bool {
        standings.rows.allSatisfy(\.isMe)
    }

    /// The global list. When I keep off it (`inGlobal` is false) only my own row is shown (when I have a rank). When my rank
    /// is further down than the rows loaded, my row comes last, after a «…».
    static func global(_ standings: GlobalStandings, inGlobal: Bool) -> [LeaderboardItem] {
        guard inGlobal else { return standings.me.map { [.entry(LeaderboardEntry($0))] } ?? [] }
        var items = standings.rows.map { LeaderboardItem.entry(LeaderboardEntry($0)) }
        if let me = standings.me, !standings.rows.contains(where: \.isMe) {
            // My own rank, even when it is on a page not loaded: a «…» shows that ranks are missing before it.
            if let last = standings.rows.last, me.rank > last.rank + 1 { items.append(.gap) }
            items.append(.entry(LeaderboardEntry(me)))
        }
        return items
    }

    /// «۳ روز مونده تا آخر هفته»: whole days left, a started day counts; never less than one.
    static func daysLeft(until end: Date, now: Date) -> Int {
        max(1, Int((end.timeIntervalSince(now) / 86_400).rounded(.up)))
    }

    static func daysLeftText(until end: Date, now: Date) -> String {
        "\(PersianDigits.string(daysLeft(until: end, now: now))) روز مونده تا آخر هفته"
    }

    /// «لیگ غزل‌باز»: the tiers are the levels' names.
    static func leagueName(tier: Int) -> String {
        "لیگ \(Level.steps[min(max(tier, 0), Level.steps.count - 1)].name)"
    }
}
