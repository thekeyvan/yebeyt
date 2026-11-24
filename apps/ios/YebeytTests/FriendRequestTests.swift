import Foundation
import Testing
@testable import Yebeyt

/// Friend requests replace follows: the states of a person, what each shows, and the calls that change them.
struct FriendshipStateTests {
    @Test func eachStateOffersItsButtonsAndItsWords() {
        #expect(Friendship.none.buttons == [.send])
        #expect(Friendship.requested.buttons == [.cancel])
        #expect(Friendship.incoming.buttons == [.accept, .reject])
        #expect(Friendship.friends.buttons.isEmpty)  // «دوستین» is a chip, not a button
        #expect(Friendship.none.buttons.map(FriendCopy.title) == ["درخواست دوستی"])
        #expect(Friendship.requested.buttons.map(FriendCopy.title) == ["درخواست فرستادی"])
        #expect(Friendship.incoming.buttons.map(FriendCopy.title) == ["قبول", "رد"])
        #expect(FriendCopy.friends == "دوستین")
        #expect(FriendCopy.title(.unfriend) == "حذف از دوستا")
        #expect(FriendCopy.cancelSent == "لغو")
        #expect(FriendCopy.requestsTitle == "درخواست‌های دوستی" && FriendCopy.sentSection == "فرستادی")
        #expect(FriendCopy.confirmUnfriend(name: "سارا") == "سارا از دوستات حذف بشه؟")
        #expect(FriendCopy.confirmUnfriendButton == "حذف کن")
        #expect(FriendCopy.accepted(by: "سارا") == "سارا درخواستت رو قبول کرد")
    }

    @Test func onlyAskingAndAcceptingArePaintedAsTheMainButton() {
        #expect(FriendAction.send.isMain && FriendAction.accept.isMain)
        #expect(!FriendAction.cancel.isMain && !FriendAction.reject.isMain && !FriendAction.unfriend.isMain)  // «درخواست فرستادی» is grey
    }

    @Test func eachActionMovesOneStateToAnother() {
        let moves: [(FriendAction, Friendship, Friendship)] = [
            (.send, .none, .requested), (.cancel, .requested, .none), (.accept, .incoming, .friends),
            (.reject, .incoming, .none), (.unfriend, .friends, .none),
        ]
        for (action, from, to) in moves {
            #expect(action.requires == from && action.result == to)
        }
    }

    @MainActor @Test func aTooManyRequestsAnswerAsksToWaitAndOtherFailuresKeepTheirWords() {
        let limited = APIError.server(status: 429, code: .rateLimited, allowedAt: nil)
        #expect(FriendCopy.toast(for: limited) == "یه کم بعد دوباره امتحان کن")
        #expect(FriendCopy.toast(for: .network) == APIError.network.persianMessage)
    }
}

@MainActor
struct FriendsAPITests {
    @Test func everyActionCallsItsEndpointAndAnswersTheNewState() async throws {
        let env = SignedInStub { request in
            switch (request.method, request.path) {
            case ("POST", "/v1/friend-requests/sara"): .json(200, #"{"friendship":"friends"}"#)  // they had asked me: it accepted
            case ("POST", "/v1/friend-requests/sara/accept"): .json(200, #"{"friendship":"friends"}"#)
            default: .json(204, "")
            }
        }
        defer { env.cleanUp() }
        let api = env.stub.api
        #expect(try await api.friendAction(.send, username: "sara", token: "t") == .friends)
        #expect(try await api.friendAction(.accept, username: "sara", token: "t") == .friends)
        #expect(try await api.friendAction(.cancel, username: "sara", token: "t") == .none)
        #expect(try await api.friendAction(.reject, username: "sara", token: "t") == .none)
        #expect(try await api.friendAction(.unfriend, username: "sara", token: "t") == .none)
        let calls = env.stub.requests.map { "\($0.method) \($0.path)" }
        #expect(calls == [
            "POST /v1/friend-requests/sara", "POST /v1/friend-requests/sara/accept", "DELETE /v1/friend-requests/sara",
            "POST /v1/friend-requests/sara/reject", "DELETE /v1/friends/sara",
        ])
    }

    @Test func requestsAreAskedByDirectionAndDecoded() async throws {
        let env = SignedInStub { _ in
            .json(200, #"{"items":[{"username":"sara","displayName":"سارا","avatar":null,"createdAt":"2026-11-24T09:00:00.000Z"}],"nextCursor":"2"}"#)
        }
        defer { env.cleanUp() }
        let page = try await env.stub.api.friendRequests(.incoming, cursor: "1", token: "t")
        #expect(page.items.map(\.username) == ["sara"] && page.items[0].short.name == "سارا" && page.nextCursor == "2")
        let call = try #require(env.stub.requests.first)
        #expect(call.path == "/v1/me/friend-requests" && call.query.contains("direction=incoming") && call.query.contains("cursor=1"))
        _ = try await env.stub.api.friendRequests(.outgoing, cursor: nil, token: "t")
        #expect(env.stub.requests[1].query == "direction=outgoing")
    }

    @Test func theUnreadAnswerCarriesTheRequestCount() async throws {
        let env = SignedInStub { _ in .json(200, #"{"total":3,"friendRequests":2}"#) }
        defer { env.cleanUp() }
        let unread = try await env.stub.api.unread(token: "t")
        #expect(unread.total == 3 && unread.friendRequests == 2)
    }

    @Test func aProfileAndASearchResultCarryTheFriendshipState() throws {
        let found = try JSONDecoder().decode(FoundPerson.self, from: Data(#"{"username":"sara","displayName":null,"avatar":null,"friendship":"incoming","isFriend":false}"#.utf8))
        #expect(found.friendship == .incoming && !found.isFriend)
        let profile = try JSONDecoder().decode(
            PublicProfile.self, from: Data(#"{"username":"sara","displayName":"سارا","avatar":null,"friendsCount":3,"friendship":"friends","isFriend":true,"canMessage":true,"league":null,"weekPoints":null}"#.utf8)
        )
        #expect(profile.friendship == .friends && profile.isFriend && profile.canMessage)
    }
}

// MARK: Another person's page

@MainActor
struct PersonFriendshipTests {
    private func profile(_ friendship: String, canMessage: Bool = false) -> String {
        #"{"username":"sara","displayName":"سارا","avatar":null,"friendsCount":12,"friendship":"\#(friendship)","isFriend":\#(friendship == "friends"),"canMessage":\#(canMessage),"league":{"tier":2},"weekPoints":300}"#
    }

    /// A page that starts as `start`; once something was changed on the server (a write) the profile reads as `then`.
    private func page(_ start: String, then: String? = nil, answers: @escaping @Sendable (StubServer.Request) -> StubServer.Response) async -> (PersonModel, SignedInStub) {
        let before = profile(start)
        let after = profile(then ?? start, canMessage: then == "friends")
        let written = Recorded<Int>()
        let env = SignedInStub { request in
            if request.method == "GET" { return .json(200, written.all.isEmpty ? before : after) }
            written.add(1)
            return answers(request)
        }
        let person = PersonModel(username: "sara", session: env.session)
        await person.load()
        return (person, env)
    }

    @Test func sendingARequestShowsRequestedAtOnceAndKeepsTheServersAnswer() async {
        let (person, env) = await page("none", then: "requested") { _ in .json(200, #"{"friendship":"requested"}"#) }
        defer { env.cleanUp() }
        #expect(person.friendship == .none)
        env.stub.delay = 0.2
        let task = Task { await person.perform(.send) }
        #expect(await eventually { person.friendship == .requested && person.isBusy })  // before the server answered
        await task.value
        #expect(person.friendship == .requested && !person.isBusy && person.toast == nil)
        #expect(env.stub.requests.filter { $0.path.hasPrefix("/v1/friend") }.map(\.path) == ["/v1/friend-requests/sara"])
    }

    @Test func cancellingAcceptingRejectingAndRemovingEachLandOnTheirState() async {
        let cases: [(FriendAction, String, Friendship)] = [(.cancel, "requested", .none), (.accept, "incoming", .friends), (.reject, "incoming", .none), (.unfriend, "friends", .none)]
        for (action, start, end) in cases {
            let (person, env) = await page(start, then: end == .friends ? "friends" : "none") { request in request.path.hasSuffix("/accept") ? .json(200, #"{"friendship":"friends"}"#) : .json(204, "") }
            #expect(person.friendship.buttons.contains(action) || action == .unfriend)
            await person.perform(action)
            #expect(person.friendship == end, "\(action)")
            env.cleanUp()
        }
    }

    @Test func aRequestTheyAlreadySentBecomesFriendsWhateverWeAskedFor() async {
        let (person, env) = await page("none", then: "friends") { _ in .json(200, #"{"friendship":"friends"}"#) }
        defer { env.cleanUp() }
        await person.perform(.send)
        #expect(person.friendship == .friends)
    }

    @Test func aRefusedActionGoesBackWithAToast() async {
        let (person, env) = await page("incoming") { _ in .json(500, #"{"error":"internal_error"}"#) }
        defer { env.cleanUp() }
        await person.perform(.accept)
        #expect(person.friendship == .incoming && !person.isBusy)
        #expect(person.toast == APIError.server(status: 500, code: .internalError, allowedAt: nil).persianMessage)
    }

    @Test func tooManyRequestsGoBackAndAskToWait() async {
        let (person, env) = await page("none") { _ in .json(429, #"{"error":"rate_limited"}"#) }
        defer { env.cleanUp() }
        await person.perform(.send)
        #expect(person.friendship == .none)
        #expect(person.toast == "یه کم بعد دوباره امتحان کن")
    }

    @Test func anActionThatDoesNotFitTheStateDoesNothing() async {
        let (person, env) = await page("friends") { _ in .json(204, "") }
        defer { env.cleanUp() }
        await person.perform(.send)
        #expect(env.stub.requests.filter { $0.path.hasPrefix("/v1/friend") }.isEmpty && person.friendship == .friends)
    }

    @Test func becomingFriendsReadsThePageAgainForTheMessageButton() async {
        let before = profile("incoming")
        let after = profile("friends", canMessage: true)
        let env = SignedInStub { request in request.method == "GET" ? .json(200, before) : .json(200, #"{"friendship":"friends"}"#) }
        defer { env.cleanUp() }
        let person = PersonModel(username: "sara", session: env.session)
        await person.load()
        #expect(!person.canMessage)
        env.respond { request in request.method == "GET" ? .json(200, after) : .json(200, #"{"friendship":"friends"}"#) }
        await person.perform(.accept)
        #expect(person.friendship == .friends && person.canMessage)
    }
}

// MARK: Search rows

@MainActor
struct SearchFriendshipTests {
    private func found(_ state: String) -> String {
        #"{"items":[{"username":"sara","displayName":"سارا","avatar":null,"friendship":"\#(state)","isFriend":\#(state == "friends")}]}"#
    }

    private func search(_ state: String, _ answers: @escaping @Sendable (StubServer.Request) -> StubServer.Response) async -> (PeopleSearchModel, SignedInStub) {
        let list = found(state)
        let env = SignedInStub { request in request.method == "GET" ? .json(200, list) : answers(request) }
        let model = PeopleSearchModel(session: env.session, debounce: .milliseconds(1))
        model.queryChanged("sara")
        await model.settle()
        return (model, env)
    }

    @Test func aRowAsksThenWaitsThenCancels() async {
        let (model, env) = await search("none") { request in request.method == "POST" ? .json(200, #"{"friendship":"requested"}"#) : .json(204, "") }
        defer { env.cleanUp() }
        #expect(model.people[0].friendship == .none)
        #expect(await model.perform(.send, on: "sara") == nil)
        #expect(model.people[0].friendship == .requested && !model.people[0].isFriend)
        #expect(await model.perform(.cancel, on: "sara") == nil)  // no confirmation
        #expect(model.people[0].friendship == .none)
        #expect(env.stub.requests.filter { $0.path.hasPrefix("/v1/friend") }.map { "\($0.method) \($0.path)" } == ["POST /v1/friend-requests/sara", "DELETE /v1/friend-requests/sara"])
    }

    @Test func acceptingARowMakesThemAFriend() async {
        let (model, env) = await search("incoming") { _ in .json(200, #"{"friendship":"friends"}"#) }
        defer { env.cleanUp() }
        #expect(await model.perform(.accept, on: "sara") == nil)
        #expect(model.people[0].friendship == .friends && model.people[0].isFriend)
    }

    @Test func aRefusedRowGoesBackAndGivesTheMessage() async {
        let (model, env) = await search("none") { _ in .json(429, #"{"error":"rate_limited"}"#) }
        defer { env.cleanUp() }
        #expect(await model.perform(.send, on: "sara") == "یه کم بعد دوباره امتحان کن")
        #expect(model.people[0].friendship == .none && model.pending.isEmpty)
    }

    @Test func aRowShowsTheNewStateBeforeTheServerAnswers() async {
        let (model, env) = await search("none") { _ in .json(200, #"{"friendship":"requested"}"#) }
        defer { env.cleanUp() }
        env.stub.delay = 0.2
        let task = Task { await model.perform(.send, on: "sara") }
        #expect(await eventually { model.people[0].friendship == .requested && model.pending.contains("sara") })
        #expect(await model.perform(.cancel, on: "sara") == nil)  // a second tap waits for the first
        _ = await task.value
        #expect(env.stub.requests.filter { $0.method == "DELETE" }.isEmpty)
    }
}

// MARK: My friends and the requests

@MainActor
struct FriendRequestsModelTests {
    private func request(_ username: String, name: String? = nil) -> String {
        #"{"username":"\#(username)","displayName":\#(name.map { "\"\($0)\"" } ?? "null"),"avatar":null,"createdAt":"2026-11-24T09:00:00.000Z"}"#
    }

    private func page(_ items: [String], next: String? = nil) -> String {
        #"{"items":[\#(items.joined(separator: ","))],"nextCursor":\#(next.map { "\"\($0)\"" } ?? "null")}"#
    }

    private func model(extra: @escaping @Sendable (StubServer.Request) -> StubServer.Response = { _ in .json(204, "") }) -> (FriendRequestsModel, SignedInStub) {
        let incoming = page([request("aryan", name: "آرین")], next: "2")
        let more = page([request("bardia")])
        let outgoing = page([request("paria", name: "پریا")])
        let env = SignedInStub { r in
            guard r.path == "/v1/me/friend-requests" else { return extra(r) }
            if r.query.contains("outgoing") { return .json(200, outgoing) }
            return .json(200, r.query.contains("cursor=2") ? more : incoming)
        }
        return (FriendRequestsModel(session: env.session), env)
    }

    @Test func bothListsLoadAllTheirPages() async {
        let (requests, env) = model()
        defer { env.cleanUp() }
        await requests.load()
        #expect(requests.phase == .loaded)
        #expect(requests.incoming.map(\.username) == ["aryan", "bardia"] && requests.outgoing.map(\.username) == ["paria"])
        #expect(requests.incomingCount == 2)
    }

    @Test func aFailedLoadIsFailedAndAnEmptyOneIsLoaded() async {
        let env = SignedInStub { _ in .offline }
        defer { env.cleanUp() }
        let requests = FriendRequestsModel(session: env.session)
        await requests.load()
        #expect(requests.phase == .failed(APIError.network.persianMessage))
        env.respond { _ in .json(200, #"{"items":[],"nextCursor":null}"#) }
        await requests.load()
        #expect(requests.phase == .loaded && requests.incoming.isEmpty && requests.outgoing.isEmpty && requests.incomingCount == 0)
    }

    @Test func acceptingTakesTheRowAwayAndCountsOneLess() async {
        let (requests, env) = model { _ in .json(200, #"{"friendship":"friends"}"#) }
        defer { env.cleanUp() }
        await requests.load()
        #expect(await requests.perform(.accept, on: "aryan") == nil)
        #expect(requests.incoming.map(\.username) == ["bardia"] && requests.incomingCount == 1)
        #expect(env.stub.requests.last.map { "\($0.method) \($0.path)" } == "POST /v1/friend-requests/aryan/accept")
    }

    @Test func rejectingJustRemovesTheRow() async {
        let (requests, env) = model()
        defer { env.cleanUp() }
        await requests.load()
        #expect(await requests.perform(.reject, on: "bardia") == nil)
        #expect(requests.incoming.map(\.username) == ["aryan"] && requests.incomingCount == 1)
        #expect(env.stub.requests.last.map { "\($0.method) \($0.path)" } == "POST /v1/friend-requests/bardia/reject")
    }

    @Test func cancellingARequestISentRemovesItFromTheSentSection() async {
        let (requests, env) = model()
        defer { env.cleanUp() }
        await requests.load()
        #expect(await requests.perform(.cancel, on: "paria") == nil)
        #expect(requests.outgoing.isEmpty && requests.incomingCount == 2)
        #expect(env.stub.requests.last.map { "\($0.method) \($0.path)" } == "DELETE /v1/friend-requests/paria")
    }

    @Test func aRefusedAnswerBringsTheRowBackWhereItWasAndSaysWhy() async {
        let (requests, env) = model { _ in .json(429, #"{"error":"rate_limited"}"#) }
        defer { env.cleanUp() }
        await requests.load()
        #expect(await requests.perform(.accept, on: "aryan") == "یه کم بعد دوباره امتحان کن")
        #expect(requests.incoming.map(\.username) == ["aryan", "bardia"] && requests.incomingCount == 2 && requests.pending.isEmpty)
    }

    @Test func aRowShowsGoneBeforeTheServerAnswers() async {
        let (requests, env) = model { _ in .json(204, "") }
        defer { env.cleanUp() }
        await requests.load()
        env.stub.delay = 0.2
        let task = Task { await requests.perform(.reject, on: "aryan") }
        #expect(await eventually { requests.incoming.map(\.username) == ["bardia"] })
        _ = await task.value
    }

    @Test func aLiveRequestJoinsTheTopOnceAndAnAcceptedOneLeavesTheSentSection() async {
        let (requests, env) = model()
        defer { env.cleanUp() }
        await requests.load()
        let kian = PersonShort(username: "kian_k", displayName: "کیان", avatar: nil)
        requests.received(from: kian)
        requests.received(from: kian)  // the same request again changes nothing
        #expect(requests.incoming.map(\.username) == ["kian_k", "aryan", "bardia"] && requests.incomingCount == 3)
        requests.removeSent(to: "paria")
        #expect(requests.outgoing.isEmpty)
    }

    @Test func theCountFromTheServerStandsUntilTheListIsRead() {
        let env = SignedInStub()
        defer { env.cleanUp() }
        var counts: [Int] = []
        let requests = FriendRequestsModel(session: env.session)
        requests.onCountChange = { counts.append($0) }
        requests.setCount(3)
        requests.setCount(3)
        requests.received(from: PersonShort(username: "a", displayName: nil, avatar: nil))
        #expect(requests.incomingCount == 4 && counts == [3, 4])
        requests.reset()
        #expect(requests.incomingCount == 0 && requests.incoming.isEmpty && counts == [3, 4, 0])
    }

    @Test func myFriendsListComesFromTheFriendsEndpointAsFriends() async {
        let env = SignedInStub { _ in .json(200, #"{"items":[{"username":"a","displayName":"آ","avatar":null}],"nextCursor":null}"#) }
        defer { env.cleanUp() }
        await env.session.restore()
        let friends = FriendsListModel(session: env.session)
        await friends.load()
        #expect(friends.people.map(\.username) == ["a"] && friends.people[0].friendship == .friends && friends.people[0].isFriend)
        #expect(env.stub.requests.last?.path == "/v1/me/friends")
    }
}

// MARK: The messages side: the badge and live events

@MainActor
struct FriendRequestsCenterTests {
    private func center(_ handler: @escaping @Sendable (StubServer.Request) -> StubServer.Response) -> (MessagesCenter, StubServer) {
        let stub = StubServer(handler)
        return (MessagesCenter(session: signedInSession(stub.api), sockets: FakeLiveSockets()), stub)
    }

    @Test func theBadgeIsTheUnreadMessagesPlusTheIncomingRequests() async {
        let (center, _) = center { _ in .json(200, #"{"total":2,"friendRequests":3}"#) }
        var badge: [Int] = []
        center.onUnread = { badge.append($0) }
        await center.refreshUnread()
        #expect(center.unread == 2 && center.requests.incomingCount == 3 && badge.last == 5)
        center.handle(.friendRequest(from: PersonShort(username: "kian_k", displayName: "کیان", avatar: nil)))
        #expect(center.requests.incomingCount == 4 && badge.last == 6)
        center.handle(.message(try! MessageJSON.decoded(MessageJSON.message(id: "m1", conversation: "c1", text: "سلام"))))
        #expect(badge.last == 7)
        center.reset()
        #expect(badge.last == 0)
    }

    @Test func acceptingARequestLowersTheBadge() async {
        let (center, _) = center { request in
            switch request.path {
            case "/v1/me/unread": .json(200, #"{"total":0,"friendRequests":1}"#)
            case "/v1/me/friend-requests": .json(200, request.query.contains("incoming") ? #"{"items":[{"username":"aryan","displayName":null,"avatar":null,"createdAt":"2026-11-24T09:00:00.000Z"}],"nextCursor":null}"# : #"{"items":[],"nextCursor":null}"#)
            default: .json(200, #"{"friendship":"friends"}"#)
            }
        }
        var badge: [Int] = []
        center.onUnread = { badge.append($0) }
        await center.refreshUnread()
        await center.requests.load()
        #expect(await center.requests.perform(.accept, on: "aryan") == nil)
        #expect(badge == [1, 0])
    }

    @Test func aLiveRequestAddsARowAndBumpsTheRevisionButShowsNoToast() {
        let (center, _) = center { _ in .json(404, "{}") }
        var toasts: [String] = []
        center.onToast = { toasts.append($0) }
        let before = center.friendsRevision
        center.handle(.friendRequest(from: PersonShort(username: "kian_k", displayName: "کیان", avatar: nil)))
        #expect(center.requests.incoming.map(\.username) == ["kian_k"] && center.friendsRevision == before + 1 && toasts.isEmpty)
    }

    @Test func aLiveAcceptanceTellsWhoAcceptedAndRefreshesWhatIsShown() {
        let (center, _) = center { _ in .json(404, "{}") }
        var toasts: [String] = []
        center.onToast = { toasts.append($0) }
        center.requests.received(from: PersonShort(username: "x", displayName: nil, avatar: nil))
        let before = center.friendsRevision
        center.handle(.friendAccepted(from: PersonShort(username: "sara", displayName: "سارا", avatar: nil)))
        #expect(toasts == ["سارا درخواستت رو قبول کرد"] && center.friendsRevision == before + 1)
        center.handle(.friendAccepted(from: PersonShort(username: "aryan", displayName: nil, avatar: nil)))
        #expect(toasts.last == "aryan درخواستت رو قبول کرد")
    }

    /// A center whose unread answer has `before` requests, and `after` once something was written (an accept, a reject, a block).
    private func centerWithRequests(before: Int = 2, after: Int = 1) -> (MessagesCenter, StubServer) {
        let written = Recorded<Int>()
        let profile = #"{"username":"aryan","displayName":"آرین","avatar":null,"friendsCount":3,"friendship":"incoming","isFriend":false,"canMessage":false,"league":null,"weekPoints":null}"#
        return center { request in
            switch (request.method, request.path) {
            case ("GET", "/v1/me/unread"): return .json(200, #"{"total":1,"friendRequests":\#(written.all.isEmpty ? before : after)}"#)
            case ("GET", "/v1/users/aryan"): return .json(200, profile)
            case ("GET", "/v1/users/search"): return .json(200, #"{"items":[{"username":"aryan","displayName":"آرین","avatar":null,"friendship":"incoming","isFriend":false}]}"#)
            case ("POST", _): written.add(1); return .json(200, #"{"friendship":"friends"}"#)
            default: written.add(1); return .json(204, "")
            }
        }
    }

    @Test func acceptingOnAPersonsPageLowersTheBadgeAtOnceAndRefreshesMyFriends() async {
        let (center, stub) = centerWithRequests()
        var badge: [Int] = []
        center.onUnread = { badge.append($0) }
        await center.refreshUnread()
        #expect(badge.last == 3)
        let person = PersonModel(username: "aryan", session: center.session, center: center)
        await person.load()
        let revision = center.friendsRevision
        await person.perform(.accept)
        #expect(center.requests.incomingCount == 1 && badge.last == 2)
        #expect(center.friendsRevision == revision + 1)
        #expect(await eventually { stub.requests(to: "/v1/me/unread").count == 2 })  // and the server's count is read again
        #expect(center.requests.incomingCount == 1)
    }

    @Test func rejectingOnAPersonsPageLowersTheBadgeButFriendsStayAsTheyWere() async {
        let (center, _) = centerWithRequests()
        await center.refreshUnread()
        let person = PersonModel(username: "aryan", session: center.session, center: center)
        await person.load()
        let revision = center.friendsRevision
        await person.perform(.reject)
        #expect(center.requests.incomingCount == 1 && center.friendsRevision == revision)
    }

    @Test func acceptingFromASearchRowDropsTheRequestRowAndTheCount() async {
        let (center, _) = centerWithRequests(before: 1, after: 0)
        center.requests.received(from: PersonShort(username: "aryan", displayName: "آرین", avatar: nil))
        let search = PeopleSearchModel(session: center.session, debounce: .milliseconds(1), center: center)
        search.queryChanged("ary")
        await search.settle()
        let revision = center.friendsRevision
        #expect(await search.perform(.accept, on: "aryan") == nil)
        #expect(center.requests.incoming.isEmpty && center.requests.incomingCount == 0 && center.friendsRevision == revision + 1)
    }

    @Test func blockingSomeoneWhoAskedTakesTheirRequestAway() async {
        let (center, _) = centerWithRequests(before: 1, after: 0)
        center.requests.received(from: PersonShort(username: "aryan", displayName: nil, avatar: nil))
        let person = PersonModel(username: "aryan", session: center.session, center: center)
        #expect(await person.block())
        #expect(center.requests.incoming.isEmpty && center.requests.incomingCount == 0)
    }

    @Test func theSocketsFramesBecomeTheTwoEvents() throws {
        let request = LiveEvent.decode(#"{"type":"friend.request","from":{"username":"kian_k","displayName":"کیان","avatar":null}}"#)
        #expect(request == .friendRequest(from: PersonShort(username: "kian_k", displayName: "کیان", avatar: nil)))
        let accepted = LiveEvent.decode(#"{"type":"friend.accepted","from":{"username":"sara","displayName":null,"avatar":null}}"#)
        #expect(accepted == .friendAccepted(from: PersonShort(username: "sara", displayName: nil, avatar: nil)))
        #expect(LiveEvent.decode(#"{"type":"friend.request"}"#) == nil)
    }

    @Test func aReconnectReadsTheRequestsAgainWhenTheScreenIsOpen() async {
        let (center, stub) = center { request in
            request.path == "/v1/me/unread" ? .json(200, #"{"total":0,"friendRequests":0}"#) : .json(200, #"{"items":[],"nextCursor":null}"#)
        }
        center.requests.isVisible = true
        await center.reconnected()
        #expect(stub.requests.contains { $0.path == "/v1/me/friend-requests" })
    }
}

#if DEBUG
// MARK: The stub of -beytSignedIn

struct FriendsStubTests {
    private func answer(_ relations: DebugFriendsBackend.Relations, _ method: String, _ path: String, query: String = "") throws -> (Int, String) {
        try #require(DebugFriendsBackend.answer(method: method, path: path, query: query, relations: relations))
    }

    private func usernames(_ text: String) throws -> [String] {
        try JSONDecoder().decode(FriendRequestsPage.self, from: Data(text.utf8)).items.map(\.username)
    }

    @Test func theStubHoldsRequestsInBothDirectionsAndMovesThemLikeTheServer() throws {
        let relations = DebugFriendsBackend.Relations()
        #expect(try usernames(answer(relations, "GET", "/v1/me/friend-requests", query: "direction=incoming").1) == ["aryan", "bardia"])
        #expect(try usernames(answer(relations, "GET", "/v1/me/friend-requests", query: "direction=outgoing").1) == ["paria"])
        #expect(relations.incomingCount == 2)

        #expect(try answer(relations, "POST", "/v1/friend-requests/aryan/accept") == (200, #"{"friendship":"friends"}"#))
        #expect(try usernames(answer(relations, "GET", "/v1/me/friend-requests", query: "direction=incoming").1) == ["bardia"])
        #expect(try answer(relations, "POST", "/v1/friend-requests/bardia/reject").0 == 204)
        #expect(relations.incomingCount == 0)

        #expect(try answer(relations, "POST", "/v1/friend-requests/raha") == (200, #"{"friendship":"requested"}"#))
        #expect(try usernames(answer(relations, "GET", "/v1/me/friend-requests", query: "direction=outgoing").1) == ["paria", "raha"])
        #expect(try answer(relations, "DELETE", "/v1/friend-requests/raha").0 == 204)
        #expect(try answer(relations, "DELETE", "/v1/friends/aryan").0 == 204)
    }

    @Test func theStubsProfilesAndSearchShowTheCurrentState() throws {
        let relations = DebugFriendsBackend.Relations()
        func state(_ username: String) throws -> Friendship {
            try JSONDecoder().decode(PublicProfile.self, from: Data(answer(relations, "GET", "/v1/users/\(username)").1.utf8)).friendship
        }
        #expect(try state("raha") == .none && state("paria") == .requested && state("aryan") == .incoming && state("kian_k") == .friends)
        _ = try answer(relations, "POST", "/v1/friend-requests/aryan/accept")
        #expect(try state("aryan") == .friends)
        let found = try JSONDecoder().decode(UserSearch.self, from: Data(answer(relations, "GET", "/v1/users/search", query: "q=ma").1.utf8)).items
        #expect(found.first { $0.username == "aryan" }?.friendship == .friends && found.first { $0.username == "raha" }?.friendship == Friendship.none)
    }

    @Test func theFriendsListAnswersShortPeople() throws {
        let page = try JSONDecoder().decode(PeoplePage.self, from: Data(answer(.init(), "GET", "/v1/me/friends").1.utf8))
        #expect(page.items.first?.username == "sara.ghazal" && page.nextCursor == "2")
    }
}
#endif
