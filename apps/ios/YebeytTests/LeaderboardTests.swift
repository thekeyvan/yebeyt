import Foundation
import Testing
@testable import Yebeyt

private func row(_ rank: Int, _ name: String?, points: Int, me: Bool = false, hidden: Bool = false) -> LeaderboardRow {
    LeaderboardRow(rank: rank, username: name.map { "u\($0)" }, displayName: name, avatar: nil, points: points, isMe: me, hidden: hidden)
}

struct LeaderboardLayoutTests {
    private let rows = [
        row(1, "آرین", points: 2910), row(2, "سارا", points: 2640), row(3, "تو", points: 2480, me: true), row(4, "کیان", points: 2310),
        row(5, "مهسا", points: 2090), row(6, nil, points: 1950, hidden: true), row(7, "پریا", points: 1720), row(8, "رها", points: 1610),
    ]

    private func league(_ rows: [LeaderboardRow]) -> LeagueStandings {
        LeagueStandings(week: "2026-W47", tier: 2, endsAt: "2026-11-27T20:30:00.000Z", rows: rows, promoteCount: 5, demoteCount: 5)
    }

    @Test func theLeagueHasMedalsForTheFirstThreeAndPersianPoints() {
        let items = LeaderboardLayout.league(league(rows))
        let entries = items.compactMap { item -> LeaderboardEntry? in if case .entry(let entry) = item { entry } else { nil } }
        #expect(entries.map(\.medal) == [.gold, .silver, .bronze, nil, nil, nil, nil, nil])
        #expect(entries[0].points == "۲٬۹۱۰")
        #expect(entries[3].rankText == "۴")
    }

    @Test func myRowIsCalledتوAndFlagged() {
        let me = LeaderboardLayout.league(league(rows)).compactMap { item -> LeaderboardEntry? in if case .entry(let entry) = item, entry.isMe { entry } else { nil } }
        #expect(me.count == 1 && me[0].name == "تو" && me[0].rank == 3 && me[0].opensPerson == nil)
    }

    @Test func theBandComesAfterTheFifthRowOnly() {
        let items = LeaderboardLayout.league(league(rows))
        #expect(items.count == 9)
        #expect(items[5] == .promoteBand(5))
        if case .entry(let after) = items[6] { #expect(after.rank == 6) } else { Issue.record("a row follows the band") }
        // Five people or fewer: nobody is below the band, so it is not drawn.
        #expect(!LeaderboardLayout.league(league(Array(rows.prefix(5)))).contains { if case .promoteBand = $0 { true } else { false } })
    }

    @Test func aHiddenStrangerIsSomeoneWithoutNameOrFace() {
        let entry = LeaderboardEntry(LeaderboardRow(rank: 6, username: "leak", displayName: "leak", avatar: .standard, points: 1950, isMe: false, hidden: true))
        #expect(entry.name == "یه نفر" && entry.isHidden && entry.avatar == nil && entry.username == nil && entry.opensPerson == nil)
        #expect(entry.points == "۱٬۹۵۰")
    }

    @Test func aRowWithoutADisplayNameShowsTheUsername() {
        let entry = LeaderboardEntry(LeaderboardRow(rank: 4, username: "kian_k", displayName: nil, avatar: nil, points: 5, isMe: false, hidden: false))
        #expect(entry.name == "kian_k" && entry.opensPerson == "kian_k")
    }

    @Test func friendsWithNoFriendsHasOnlyMe() {
        #expect(LeaderboardLayout.hasNoFriends(FriendsStandings(week: "w", rows: [row(1, "من", points: 0, me: true)])))
        #expect(!LeaderboardLayout.hasNoFriends(FriendsStandings(week: "w", rows: [row(1, "سارا", points: 9), row(2, "من", points: 0, me: true)])))
    }

    @Test func whenIKeepOffTheGlobalListOnlyMyOwnRowShows() {
        let standings = GlobalStandings(week: "w", rows: [row(1, "آرین", points: 900)], me: row(42, "من", points: 120, me: true), nextCursor: nil)
        let items = LeaderboardLayout.global(standings, inGlobal: false)
        #expect(items.count == 1)
        if case .entry(let entry) = items[0] { #expect(entry.isMe && entry.rank == 42) }
        #expect(LeaderboardLayout.global(GlobalStandings(week: "w", rows: [], me: nil, nextCursor: nil), inGlobal: false).isEmpty)
    }

    @Test func whenIAmOnTheGlobalListMyRankIsAddedIfItIsOnAnotherPage() {
        let standings = GlobalStandings(week: "w", rows: [row(1, "آرین", points: 900)], me: row(80, "من", points: 120, me: true), nextCursor: "c")
        #expect(LeaderboardLayout.global(standings, inGlobal: true).count == 2)
        let onPage = GlobalStandings(week: "w", rows: [row(1, "من", points: 900, me: true)], me: row(1, "من", points: 900, me: true), nextCursor: nil)
        #expect(LeaderboardLayout.global(onPage, inGlobal: true).count == 1)
    }

    @Test func theWeekEndsInWholeDaysAndAStartedDayCounts() {
        let end = Date(timeIntervalSince1970: 1_000_000)
        #expect(LeaderboardLayout.daysLeft(until: end, now: end.addingTimeInterval(-3 * 86_400)) == 3)
        #expect(LeaderboardLayout.daysLeft(until: end, now: end.addingTimeInterval(-2.2 * 86_400)) == 3)
        #expect(LeaderboardLayout.daysLeft(until: end, now: end.addingTimeInterval(-3600)) == 1)
        #expect(LeaderboardLayout.daysLeft(until: end, now: end.addingTimeInterval(500)) == 1)
        #expect(LeaderboardLayout.daysLeftText(until: end, now: end.addingTimeInterval(-3 * 86_400)) == "۳ روز مونده تا آخر هفته")
    }

    @Test func theLeagueIsNamedAfterItsTier() {
        #expect(LeaderboardLayout.leagueName(tier: 2) == "لیگ غزل‌باز")
        #expect(LeaderboardLayout.leagueName(tier: 0) == "لیگ نوآموز")
        #expect(LeaderboardLayout.leagueName(tier: 9) == "لیگ استاد سخن")
    }
}

@MainActor
struct LeaderboardModelTests {
    private func server() -> @Sendable (StubServer.Request) -> StubServer.Response {
        { request in
            switch request.path {
            case "/v1/leaderboard/league": return .json(200, #"{"week":"w","tier":2,"endsAt":"2026-11-27T20:30:00.000Z","rows":[{"rank":1,"username":"a","displayName":"آرین","avatar":null,"points":10,"isMe":true,"hidden":false}],"promoteCount":5,"demoteCount":5}"#)
            case "/v1/leaderboard/friends": return .json(200, #"{"week":"w","rows":[]}"#)
            case "/v1/leaderboard/global":
                return request.query.isEmpty
                    ? .json(200, #"{"week":"w","rows":[{"rank":1,"username":"a","displayName":null,"avatar":null,"points":10,"isMe":false,"hidden":false}],"me":null,"nextCursor":"2"}"#)
                    : .json(200, #"{"week":"w","rows":[{"rank":2,"username":"b","displayName":null,"avatar":null,"points":9,"isMe":false,"hidden":false}],"me":null,"nextCursor":null}"#)
            default: return .json(404, "{}")
            }
        }
    }

    @Test func eachTabAsksItsOwnBoardOnceAndKeepsTheAnswer() async {
        let env = SignedInStub(server())
        defer { env.cleanUp() }
        let model = LeaderboardModel(session: env.session)
        await model.load()
        await model.load()
        #expect(env.stub.requests(to: "/v1/leaderboard/league").count == 1)
        #expect(model.league?.tier == 2 && model.phase(of: .league) == .loaded)
        model.tab = .friends
        await model.load()
        #expect(model.friends?.rows.isEmpty == true)
        model.tab = .global
        await model.load()
        await model.loadMoreGlobal()
        #expect(model.global?.rows.map(\.rank) == [1, 2] && !model.hasMoreGlobal)
        #expect(env.stub.requests(to: "/v1/leaderboard/global").map(\.query) == ["", "cursor=2"])
    }

    @Test func aFailedBoardSaysSoAndCanBeTriedAgain() async {
        let env = SignedInStub { _ in .offline }
        defer { env.cleanUp() }
        let model = LeaderboardModel(session: env.session)
        await model.load()
        #expect(model.phase(of: .league) == .failed(APIError.network.persianMessage))
        env.respond(server())
        await model.load()
        #expect(model.phase(of: .league) == .loaded)
    }
}
