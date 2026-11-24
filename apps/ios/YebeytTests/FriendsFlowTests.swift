import Foundation
import Testing
@testable import Yebeyt

// MARK: Feed words

struct FeedTextTests {
    private let kian = PersonShort(username: "kian_k", displayName: "کیان", avatar: nil)

    @Test func eachKindOfItemHasItsLine() {
        let repost = FeedItem(type: .repost, user: kian, key: "/hafez/ghazal/sh3#0", date: nil, tries: nil, at: "2026-11-24T08:00:00.000Z")
        let like = FeedItem(type: .like, user: kian, key: "/hafez/ghazal/sh3#0", date: nil, tries: nil, at: "2026-11-24T08:00:00.000Z")
        let daily = FeedItem(type: .daily, user: PersonShort(username: "sara", displayName: nil, avatar: nil), key: nil, date: "2026-11-24", tries: 3, at: "2026-11-24T08:00:00.000Z")
        #expect(FeedText.headline(repost) == "کیان یه بیت به اشتراک گذاشت")
        #expect(FeedText.headline(like) == "کیان یه بیت پسندید")
        let now = ServerTime.date(from: "2026-11-24T09:00:00.000Z")!
        #expect(FeedText.headline(daily, now: now) == "sara معمای امروز رو با ۳ فرصت حل کرد")
        var yesterday = daily
        yesterday.date = "2026-11-23"
        #expect(FeedText.headline(yesterday, now: now) == "sara معمای دیروز رو با ۳ فرصت حل کرد")
        yesterday.date = "2026-11-22"
        #expect(FeedText.headline(yesterday, now: now) == "sara معمای \(TehranDay(key: "2026-11-22")!.shortLine) رو با ۳ فرصت حل کرد")
        #expect(FeedText.isTodaysDaily(daily, now: now) && !FeedText.isTodaysDaily(yesterday, now: now) && !FeedText.isTodaysDaily(repost, now: now))
    }

    @Test func timesAreRelativeInPersian() {
        let now = ServerTime.date(from: "2026-11-24T12:00:00.000Z")!
        func text(_ at: String) -> String { FeedText.relativeTime(at, now: now) }
        #expect(text("2026-11-24T11:59:40.000Z") == "همین الان")
        #expect(text("2026-11-24T11:50:00.000Z") == "۱۰ دقیقه پیش")
        #expect(text("2026-11-24T11:00:00.000Z") == "یک ساعت پیش")
        #expect(text("2026-11-24T09:00:00.000Z") == "۳ ساعت پیش")
        #expect(text("2026-11-23T09:00:00.000Z") == "دیروز")
        #expect(text("2026-11-21T09:00:00.000Z") == "۳ روز پیش")
        #expect(!text("2026-10-01T09:00:00.000Z").contains("پیش"))
        #expect(text("garbage").isEmpty)
    }

    @Test func aCoupletKeyOpensItsPoemAtItsCouplet() {
        #expect(FeedText.coupletRoute(of: "/hafez/ghazal/sh3#4") == ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 4))
        #expect(FeedText.coupletRoute(of: "nope") == nil)
        #expect(FeedText.coupletRoute(of: "/a#x") == nil)
    }
}

// MARK: Feed paging

@MainActor
struct FeedModelTests {
    private func item(_ n: Int) -> String {
        #"{"type":"like","user":{"username":"kian_k","displayName":"کیان","avatar":null},"key":"/a/b#\#(n)","at":"2026-11-24T08:00:0\#(n).000Z"}"#
    }

    @Test func pagesAreAppendedWithoutRepeatsAndRefreshStartsOver() async {
        let first = item(1)
        let second = item(2)
        let env = SignedInStub { request in
            request.query.contains("cursor=next")
                ? .json(200, #"{"items":[\#(first),\#(second)],"nextCursor":null}"#)
                : .json(200, #"{"items":[\#(first)],"nextCursor":"next"}"#)
        }
        defer { env.cleanUp() }
        let feed = FeedModel(session: env.session)
        await feed.refresh()
        #expect(feed.entries.count == 1 && feed.hasMore)
        await feed.loadMore()
        #expect(feed.entries.count == 2 && !feed.hasMore)
        await feed.refresh()
        #expect(feed.entries.count == 1)
    }

    @Test func aGuestHasNoFeed() async {
        let env = SignedInStub(signedIn: false)
        defer { env.cleanUp() }
        let feed = FeedModel(session: env.session)
        await feed.refresh()
        #expect(feed.entries.isEmpty && env.stub.requests.isEmpty)
    }

    @Test func aFailedRefreshKeepsWhatWasShown() async {
        let first = item(1)
        let env = SignedInStub { _ in .json(200, #"{"items":[\#(first)],"nextCursor":null}"#) }
        defer { env.cleanUp() }
        let feed = FeedModel(session: env.session)
        await feed.refresh()
        env.respond { _ in .offline }
        await feed.refresh()
        #expect(feed.entries.count == 1)
    }
}

// MARK: Search and follow

@MainActor
struct PeopleSearchTests {
    private func person(_ username: String, following: Bool = false) -> String {
        #"{"username":"\#(username)","displayName":null,"avatar":null,"isFollowing":\#(following),"isFriend":false}"#
    }

    @Test func theSearchWaitsForAPauseInTypingAndSendsOnlyTheLastText() async {
        let env = SignedInStub { request in .json(200, #"{"items":[\#(request.query.contains("q=sara") ? #"{"username":"sara.ghazal","displayName":"سارا","avatar":null,"isFollowing":false,"isFriend":false}"# : "")]}"#) }
        defer { env.cleanUp() }
        let search = PeopleSearchModel(session: env.session, debounce: .milliseconds(80))
        search.queryChanged("sa")
        search.queryChanged("sar")
        search.queryChanged("  @Sara ")
        #expect(search.phase == .loading)
        await search.settle()
        #expect(env.stub.requests(to: "/v1/users/search").map(\.query) == ["q=sara"])
        #expect(search.people.map(\.username) == ["sara.ghazal"] && search.phase == .loaded)
    }

    @Test func oneCharacterSearchesNothing() async {
        let env = SignedInStub()
        defer { env.cleanUp() }
        let search = PeopleSearchModel(session: env.session, debounce: .milliseconds(1))
        search.queryChanged("s")
        await search.settle()
        #expect(env.stub.requests.isEmpty && search.phase == .idle && search.people.isEmpty)
        search.queryChanged("sa")
        await search.settle()
        search.queryChanged("")
        #expect(search.phase == .idle && search.people.isEmpty)
    }

    @Test func aFailedSearchSaysWhy() async {
        let env = SignedInStub { _ in .json(429, #"{"error":"rate_limited"}"#) }
        defer { env.cleanUp() }
        let search = PeopleSearchModel(session: env.session, debounce: .milliseconds(1))
        search.queryChanged("sara")
        await search.settle()
        #expect(search.phase == .failed(APIError.server(status: 429, code: .rateLimited, allowedAt: nil).persianMessage))
    }

    @Test func followingChangesTheRowAtOnceAndTheServersAnswerStands() async {
        let env = SignedInStub { request in
            switch (request.method, request.path) {
            case ("GET", "/v1/users/search"): .json(200, #"{"items":[{"username":"sara","displayName":"سارا","avatar":null,"isFollowing":false,"isFriend":false}]}"#)
            case ("PUT", "/v1/follows/sara"): .json(200, #"{"isFollowing":true,"followsYou":true,"isFriend":true}"#)
            case ("DELETE", "/v1/follows/sara"): .json(200, #"{"isFollowing":false,"followsYou":true,"isFriend":false}"#)
            default: .json(404, "{}")
            }
        }
        defer { env.cleanUp() }
        let search = PeopleSearchModel(session: env.session, debounce: .milliseconds(1))
        search.queryChanged("sara")
        await search.settle()
        #expect(search.people[0].followed == false)
        #expect(await search.toggleFollow("sara") == nil)
        #expect(search.people[0].followed && search.people[0].isFriend)
        #expect(await search.toggleFollow("sara") == nil)
        #expect(!search.people[0].followed && !search.people[0].isFriend)
        #expect(env.stub.requests.filter { $0.path == "/v1/follows/sara" }.map(\.method) == ["PUT", "DELETE"])
    }

    @Test func aRefusedFollowGoesBackAndGivesTheMessage() async {
        let env = SignedInStub { request in
            request.method == "GET"
                ? .json(200, #"{"items":[{"username":"sara","displayName":null,"avatar":null,"isFollowing":false,"isFriend":false}]}"#)
                : .json(403, #"{"error":"username_required"}"#)
        }
        defer { env.cleanUp() }
        let search = PeopleSearchModel(session: env.session, debounce: .milliseconds(1))
        search.queryChanged("sara")
        await search.settle()
        let message = await search.toggleFollow("sara")
        #expect(message != nil)
        #expect(search.people[0].followed == false)
    }

    @Test func myFriendsAreListedByPagesAndAlreadyFollowed() async {
        let env = SignedInStub { request in
            request.query.isEmpty
                ? .json(200, #"{"items":[{"username":"a","displayName":null,"avatar":null,"isFriend":true}],"nextCursor":"2"}"#)
                : .json(200, #"{"items":[{"username":"b","displayName":null,"avatar":null,"isFriend":true}],"nextCursor":null}"#)
        }
        defer { env.cleanUp() }
        let friends = FriendsListModel(session: env.session)
        await friends.load()
        #expect(friends.people.map(\.username) == ["a"] && friends.hasMore && friends.people[0].followed)
        await friends.loadMore()
        #expect(friends.people.map(\.username) == ["a", "b"] && !friends.hasMore)
    }
}

// MARK: Another person

@MainActor
struct PersonModelTests {
    private let profile = #"{"username":"sara","displayName":"سارا","avatar":null,"friendsCount":12,"isFollowing":false,"followsYou":true,"isFriend":false,"canMessage":false,"league":{"tier":2},"weekPoints":300}"#

    private func model(_ routes: @escaping @Sendable (StubServer.Request) -> StubServer.Response) -> (PersonModel, SignedInStub) {
        let env = SignedInStub(routes)
        return (PersonModel(username: "sara", session: env.session), env)
    }

    @Test func theProfileLoadsWithItsLeague() async {
        let profile = profile
        let (person, env) = model { _ in .json(200, profile) }
        defer { env.cleanUp() }
        await person.load()
        #expect(person.phase == .loaded && person.name == "سارا" && person.profile?.league?.tier == 2 && person.profile?.friendsCount == 12)
        #expect(!person.canMessage)
    }

    @Test func aMissingPersonIsNotFound() async {
        let (person, env) = model { _ in .json(404, #"{"error":"not_found"}"#) }
        defer { env.cleanUp() }
        await person.load()
        #expect(person.phase == .notFound)
    }

    @Test func followingMakesFriendsAndShowsTheMessageButton() async {
        let before = profile
        let after = profile.replacingOccurrences(of: #""isFollowing":false"#, with: #""isFollowing":true"#).replacingOccurrences(of: #""isFriend":false"#, with: #""isFriend":true"#).replacingOccurrences(of: #""canMessage":false"#, with: #""canMessage":true"#)
        let (person, env) = model { _ in .json(200, before) }
        defer { env.cleanUp() }
        await person.load()
        env.respond { request in request.method == "PUT" ? .json(200, #"{"isFollowing":true,"followsYou":true,"isFriend":true}"#) : .json(200, after) }
        await person.toggleFollow()
        #expect(person.profile?.isFollowing == true && person.canMessage)
        #expect(env.stub.requests.filter { $0.path == "/v1/follows/sara" }.map(\.method) == ["PUT"])
    }

    @Test func blockingCallsTheServerAndSaysWhenItWorked() async {
        let (person, env) = model { _ in .json(204, "") }
        defer { env.cleanUp() }
        #expect(await person.block())
        let call = env.stub.requests(to: "/v1/blocks/sara").first
        #expect(call?.method == "PUT" && call?.authorization == "Bearer a1")
    }

    @Test func aFailedBlockStaysOnThePageWithAMessage() async {
        let (person, env) = model { _ in .offline }
        defer { env.cleanUp() }
        #expect(await person.block() == false)
        #expect(person.toast == APIError.network.persianMessage)
    }

    @Test func aReportSendsTheReasonAndTheNoteAndThanks() async throws {
        let (person, env) = model { _ in .json(204, "") }
        defer { env.cleanUp() }
        #expect(await person.report(.abuse, note: "  فحش داد  "))
        let call = try #require(env.stub.requests(to: "/v1/reports").first)
        #expect(call.method == "POST")
        #expect(call.json["username"] as? String == "sara" && call.json["reason"] as? String == "abuse" && call.json["note"] as? String == "فحش داد")
        #expect(person.toast == "گزارشت رسید")
    }

    @Test func aReportWithoutANoteSendsNone() async throws {
        let (person, env) = model { _ in .json(204, "") }
        defer { env.cleanUp() }
        _ = await person.report(.spam, note: "   ")
        let call = try #require(env.stub.requests(to: "/v1/reports").first)
        #expect(call.json["note"] == nil && call.json["reason"] as? String == "spam")
    }

    @Test func theMessageButtonFollowsTheServersAnswerNotFriendship() async {
        let allowed = profile.replacingOccurrences(of: #""canMessage":false"#, with: #""canMessage":true"#)
        let (person, env) = model { _ in .json(200, allowed) }
        defer { env.cleanUp() }
        await person.load()
        #expect(person.profile?.isFriend == false && person.canMessage)
    }

    @Test func aReportNoteIsClippedToFiveHundredCodePointsLikeTheServerCounts() {
        let long = String(repeating: "👨‍👩‍👧", count: 200)  // 200 graphemes of 5 code points
        #expect(long.count == 200 && long.unicodeScalars.count == 1000)
        #expect(PersonModel.clipped(long).unicodeScalars.count == 500)
        #expect(PersonModel.clipped("کوتاه") == "کوتاه")
    }

    @Test func theReasonsAreTheThreeOnTheBoard() {
        #expect(PersonModel.Reason.allCases.map(\.title) == ["اسپم", "بی‌احترامی", "یه چیز دیگه"])
    }
}

// MARK: Stats and the games tab

@MainActor
struct MyStatsTests {
    private func local() -> GameStats {
        let stats = GameStats(defaults: UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!)
        stats.award(120)
        return stats
    }

    @Test func aGuestSeesThePhonesPointsAndNeverAsksTheServer() async {
        let env = SignedInStub(signedIn: false)
        defer { env.cleanUp() }
        let stats = MyStats(local: local(), session: env.session)
        await stats.refresh()
        await stats.refreshFriends(on: TehranDay(key: "2026-11-24")!)
        #expect(stats.points == 120 && stats.friendsLine == nil && env.stub.requests.isEmpty)
    }

    @Test func aSignedInPersonSeesTheServersPointsAndStreakOnceItAnswers() async {
        let env = SignedInStub { _ in .json(200, #"{"totalPoints":2480,"weekPoints":300,"streakDays":7,"league":{"tier":2}}"#) }
        defer { env.cleanUp() }
        let stats = MyStats(local: local(), session: env.session)
        #expect(stats.points == 120)  // until the server answers
        await stats.refresh()
        #expect(stats.points == 2480 && stats.streak == 7)
        env.respond { _ in .offline }
        await stats.refresh()
        #expect(stats.points == 2480)  // a failed refresh keeps what is shown
    }

    @Test func theFriendsLineShowsOnlyWhenSomeoneSolvedIt() async {
        let env = SignedInStub { _ in .json(200, #"{"solvedCount":0,"friends":[]}"#) }
        defer { env.cleanUp() }
        let stats = MyStats(local: local(), session: env.session)
        let day = TehranDay(key: "2026-11-24")!
        await stats.refreshFriends(on: day)
        #expect(stats.friendsLine == nil)
        env.respond { _ in .json(200, #"{"solvedCount":3,"friends":[]}"#) }
        await stats.refreshFriends(on: day)
        #expect(stats.friendsLine == "۳ تا از دوستات حلش کردن")
        #expect(env.stub.requests(to: "/v1/daily/2026-11-24/friends").count == 2)
    }

    @Test func myFriendsCountComesFromMyOwnProfile() async {
        let env = SignedInStub { _ in .json(200, #"{"username":"niloofar","displayName":null,"avatar":null,"friendsCount":12,"isFollowing":false,"followsYou":false,"isFriend":false,"canMessage":false,"league":null,"weekPoints":null}"#) }
        defer { env.cleanUp() }
        await env.session.restore()
        let stats = MyStats(local: local(), session: env.session)
        await stats.refreshFriendsCount()
        #expect(stats.friendsCount == 12)
        #expect(env.stub.requests(to: "/v1/users/niloofar").count == 1)
    }
}

struct FriendsLaunchTests {
    @Test func theFriendsRoutesOpenTheirScreens() {
        #expect(LaunchOptions(["beytRoute": "people"]).homePath == [.people])
        #expect(LaunchOptions(["beytRoute": "people:sa"]).peopleText == "sa")
        #expect(LaunchOptions(["beytRoute": "people"]).peopleText == "")
        #expect(LaunchOptions(["beytRoute": "person:sara.ghazal"]).homePath == [.person("sara.ghazal")])
        #expect(LaunchOptions(["beytRoute": "leaderboard"]).gamesPath == [.leaderboard])
        #expect(LaunchOptions(["beytRoute": "leaderboard"]).route?.isGames == true)
        #expect(LaunchOptions(["beytRoute": "friends"]).mePath == [.friends])
        #expect(LaunchOptions(["beytRoute": "friends"]).route?.isMe == true)
        #expect(LaunchOptions(["beytRoute": "person:"]).route == nil)
    }

    @Test func theLeaderboardNeedsAnAccount() {
        #expect("برای \(AccountFeature.leaderboard.title) یه حساب لازمه" == "برای دیدن رده‌بندی یه حساب لازمه")
    }
}
