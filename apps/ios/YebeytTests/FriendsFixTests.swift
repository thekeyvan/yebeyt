import Foundation
import Testing
@testable import Yebeyt

private let me = "00000000-0000-0000-0000-000000000009"  // the user of `SignedInStub`

@MainActor
struct QueueOwnerTests {
    private func request(_ points: Int) -> ScoreRequest {
        ScoreRequest(roundId: UUID().uuidString.lowercased(), game: .poet, points: points, playedAt: "2027-01-15T08:00:00.000Z")
    }

    @Test func aRoundOfAnotherAccountIsDroppedAndNeverSentAsMine() async throws {
        let env = SignedInStub()
        defer { env.cleanUp() }
        let entries = [
            ScoreSync.Entry(userId: "someone-else", item: .score(request(20))),
            ScoreSync.Entry(userId: me, item: .score(request(30))),
            ScoreSync.Entry(userId: nil, item: .score(request(40))),
        ]
        env.defaults.set(try JSONEncoder().encode(entries), forKey: ScoreSync.defaultsKey)
        let scores = ScoreSync(session: env.session, defaults: env.defaults)
        await scores.flush()
        #expect(env.stub.requests(to: "/v1/scores").map { $0.json["points"] as? Int } == [30, 40])
        #expect(!scores.hasUnsent)
    }

    @Test func aReactionOfAnotherAccountIsDropped() async throws {
        let env = SignedInStub()
        defer { env.cleanUp() }
        let changes = [
            ReactionsSync.Change(key: "/a/b#0", kind: .like, on: true, userId: "someone-else"),
            ReactionsSync.Change(key: "/a/b#1", kind: .like, on: true, userId: me),
        ]
        env.defaults.set(try JSONEncoder().encode(changes), forKey: ReactionsSync.unsentKey)
        let sync = ReactionsSync(marks: ReaderMarks(defaults: env.defaults), session: env.session, defaults: env.defaults)
        await sync.flush()
        #expect(env.stub.requests(to: "/v1/reactions/like").map(\.query) == ["key=/a/b%231"])
        #expect(!sync.hasUnsent)
    }

    @Test func theFirstPullSendsLikesMadeAsThisSameAccountThatTheServerLacks() async {
        let env = SignedInStub { request in
            request.method == "GET" ? .json(200, #"{"items":[],"nextCursor":null}"#) : .json(200, #"{"likes":1,"reposts":0,"likedByMe":true,"repostedByMe":false}"#)
        }
        defer { env.cleanUp() }
        let marks = ReaderMarks(defaults: env.defaults)
        marks.toggle(.liked, poemPath: "/a/b", couplet: 3)  // made before the sync existed
        env.defaults.set(me, forKey: ReactionsSync.ownerKey)  // by this same account
        let sync = ReactionsSync(marks: marks, session: env.session, defaults: env.defaults)
        #expect(await sync.syncNow())
        #expect(env.stub.requests(to: "/v1/reactions/like").map(\.query) == ["key=/a/b%233"])
        #expect(marks.keys(.liked) == ["/a/b#3"])
    }

    @Test func aLaterPullDoesNotPutBackWhatTheServerLost() async {
        let env = SignedInStub { request in
            request.method == "GET" ? .json(200, #"{"items":[],"nextCursor":null}"#) : .json(200, #"{"likes":1,"reposts":0,"likedByMe":true,"repostedByMe":false}"#)
        }
        defer { env.cleanUp() }
        let marks = ReaderMarks(defaults: env.defaults)
        marks.toggle(.liked, poemPath: "/a/b", couplet: 3)
        env.defaults.set(me, forKey: ReactionsSync.ownerKey)
        env.defaults.set(me, forKey: ReactionsSync.pulledKey)  // pulled before: the server's list is the truth
        let sync = ReactionsSync(marks: marks, session: env.session, defaults: env.defaults)
        await sync.syncNow()
        #expect(env.stub.requests(to: "/v1/reactions/like").isEmpty)
        #expect(marks.keys(.liked).isEmpty)
    }

    @Test func likesOfNobodyKnownAreNotUploadedAsTheNewAccounts() async {
        let env = SignedInStub { _ in .json(200, #"{"items":[],"nextCursor":null}"#) }
        defer { env.cleanUp() }
        let marks = ReaderMarks(defaults: env.defaults)
        marks.toggle(.liked, poemPath: "/a/b", couplet: 3)  // from before: nobody knows whose
        let sync = ReactionsSync(marks: marks, session: env.session, defaults: env.defaults)
        await sync.syncNow()
        #expect(env.stub.requests.filter { $0.path.hasPrefix("/v1/reactions") }.isEmpty && marks.keys(.liked).isEmpty)
    }
}

@MainActor
struct FriendsFixTests {
    @Test func theShownPointsAreNeverLessThanThePhones() async {
        let stats = GameStats(defaults: UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!)
        stats.award(900)
        let env = SignedInStub { _ in .json(200, #"{"totalPoints":300,"weekPoints":300,"streakDays":2,"league":{"tier":0}}"#) }
        defer { env.cleanUp() }
        let mine = MyStats(local: stats, session: env.session)
        await mine.refresh()
        #expect(mine.points == 900)
        stats.award(10)
        #expect(mine.points == 910)
    }

    @Test func aPagesCountsComeInOneCallWithEveryKeyOnce() async {
        func item(_ n: Int, _ key: String) -> String {
            #"{"type":"like","user":{"username":"k","displayName":null,"avatar":null},"key":"\#(key)","at":"2026-11-24T08:00:0\#(n).000Z"}"#
        }
        let page = #"{"items":[\#(item(1, "/a/b#0")),\#(item(2, "/a/b#1")),\#(item(3, "/a/b#0"))],"nextCursor":null}"#
        let env = SignedInStub { request in
            request.path == "/v1/reactions/counts"
                ? .json(200, #"{"/a/b#0":{"likes":4,"reposts":2,"likedByMe":true,"repostedByMe":false},"/a/b#1":{"likes":0,"reposts":0,"likedByMe":false,"repostedByMe":false}}"#)
                : .json(200, page)
        }
        defer { env.cleanUp() }
        let feed = FeedModel(session: env.session)
        await feed.refresh()
        let calls = env.stub.requests(to: "/v1/reactions/counts")
        #expect(calls.count == 1 && calls[0].query == "keys=/a/b%230,/a/b%231")
        #expect(feed.counts["/a/b#0"]?.likes == 4 && feed.counts["/a/b#1"]?.reposts == 0)
    }

    @Test func myOwnLikeChangesTheShownCountWithoutAskingAgain() {
        #expect(FeedModel.shown(4, serverMine: false, localMine: true) == 5)
        #expect(FeedModel.shown(4, serverMine: true, localMine: true) == 4)
        #expect(FeedModel.shown(4, serverMine: true, localMine: false) == 3)
        #expect(FeedModel.shown(0, serverMine: true, localMine: false) == 0)
    }

    @Test func aBlockedPersonLeavesEveryLoadedListAtOnce() async {
        let env = SignedInStub()
        defer { env.cleanUp() }
        await env.session.restore()
        let blocked = BlockedPeople(session: env.session)
        let people = [FoundPerson(username: "a", displayName: nil, avatar: nil, friendship: .none), FoundPerson(username: "b", displayName: nil, avatar: nil, friendship: .friends)]
        let entry = { (user: String) in
            FeedModel.Entry(id: user, item: FeedItem(type: .like, user: PersonShort(username: user, displayName: nil, avatar: nil), key: "/a/b#0", date: nil, tries: nil, at: "2026-11-24T08:00:00.000Z"))
        }
        #expect(blocked.visible(people).count == 2)
        blocked.add("a")
        #expect(blocked.visible(people).map(\.username) == ["b"])
        #expect(blocked.visible([entry("a"), entry("b")]).map(\.id) == ["b"])
    }

    @Test func blocksBelongToTheAccountThatMadeThemAndGoWithTheSignOut() async {
        let env = SignedInStub()
        defer { env.cleanUp() }
        await env.session.restore()
        let blocked = BlockedPeople(session: env.session)
        blocked.add("a")
        #expect(blocked.usernames == ["a"])
        env.session.apply(APISession(accessToken: "a2", refreshToken: "r2", user: APIUser(
            id: "00000000-0000-0000-0000-000000000002", username: "second", displayName: nil, usernameChangedAt: nil,
            createdAt: "2026-11-23T08:00:00.000Z", providers: [.google]
        )))
        #expect(blocked.usernames.isEmpty, "another account sees none of them")
        await env.session.signOut()
        blocked.add("b")  // nobody is signed in: nothing is kept
        #expect(blocked.usernames.isEmpty)
    }

    @Test func theFeedKeepsAskingWhenAWholePageIsBlocked() async {
        func item(_ user: String, _ n: Int) -> String {
            #"{"type":"daily","user":{"username":"\#(user)","displayName":null,"avatar":null},"date":"2026-11-24","tries":1,"at":"2026-11-24T08:00:0\#(n).000Z"}"#
        }
        let (first, second, third) = (item("ok", 1), item("bad", 2) + "," + item("bad", 3), item("ok2", 4))
        let env = SignedInStub { request in
            if request.query.contains("cursor=p2") { .json(200, #"{"items":[\#(second)],"nextCursor":"p3"}"#) }
            else if request.query.contains("cursor=p3") { .json(200, #"{"items":[\#(third)],"nextCursor":null}"#) }
            else { .json(200, #"{"items":[\#(first)],"nextCursor":"p2"}"#) }
        }
        defer { env.cleanUp() }
        await env.session.restore()
        let blocked = BlockedPeople(session: env.session)
        blocked.add("bad")
        let feed = FeedModel(session: env.session)
        await feed.refresh()
        await feed.loadMore(hiding: blocked)
        #expect(blocked.visible(feed.entries).map(\.item.user.username) == ["ok", "ok2"])
        #expect(!feed.hasMore)
    }

    @Test func theFriendsListKeepsAskingWhenAWholePageIsBlocked() async {
        func person(_ name: String) -> String { #"{"username":"\#(name)","displayName":null,"avatar":null,"isFriend":true}"# }
        let (a, b, c) = (person("a"), person("bad"), person("c"))
        let env = SignedInStub { request in
            if request.query.contains("cursor=p2") { .json(200, #"{"items":[\#(b)],"nextCursor":"p3"}"#) }
            else if request.query.contains("cursor=p3") { .json(200, #"{"items":[\#(c)],"nextCursor":null}"#) }
            else { .json(200, #"{"items":[\#(a)],"nextCursor":"p2"}"#) }
        }
        defer { env.cleanUp() }
        await env.session.restore()
        let blocked = BlockedPeople(session: env.session)
        blocked.add("bad")
        let friends = FriendsListModel(session: env.session)
        await friends.load()
        await friends.loadMore(hiding: blocked)
        #expect(blocked.visible(friends.people).map(\.username) == ["a", "c"])
        #expect(!friends.hasMore)
    }

    @Test func pointsCarriedToAnotherAccountAreNotCountedForThisOne() async {
        let stats = GameStats(defaults: UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!)
        stats.award(900)
        let env = SignedInStub { _ in .json(200, #"{"totalPoints":300,"weekPoints":300,"streakDays":2,"league":{"tier":0}}"#) }
        defer { env.cleanUp() }
        await env.session.restore()
        let mine = MyStats(local: stats, session: env.session)
        #expect(mine.points == 900)  // nobody's yet: these are the signed-in person's own
        _ = stats.claim(for: "someone-else")
        #expect(mine.points == 0, "until the server answers, another account's points are not shown")
        await mine.refresh()
        #expect(mine.points == 300 && mine.streak == 2)
    }

    @Test func myRowFarDownTheGlobalListComesLastAfterAGap() {
        func row(_ rank: Int, me: Bool = false) -> LeaderboardRow { LeaderboardRow(rank: rank, username: "u\(rank)", displayName: nil, avatar: nil, points: 10, isMe: me, hidden: false) }
        let far = GlobalStandings(week: "w", rows: [row(1), row(2)], me: row(80, me: true), nextCursor: "c")
        #expect(LeaderboardLayout.global(far, inGlobal: true).map(\.id) == ["row-1", "row-2", "gap", "row-80"])
        let next = GlobalStandings(week: "w", rows: [row(1), row(2)], me: row(3, me: true), nextCursor: "c")
        #expect(LeaderboardLayout.global(next, inGlobal: true).map(\.id) == ["row-1", "row-2", "row-3"])
    }

    @Test func anEmptyGlobalListHasNoRowsForSomeoneOnIt() {
        #expect(LeaderboardLayout.global(GlobalStandings(week: "w", rows: [], me: nil, nextCursor: nil), inGlobal: true).isEmpty)
    }
}
