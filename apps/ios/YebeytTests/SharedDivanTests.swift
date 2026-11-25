import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct SharedDivanTests {
    nonisolated static let divans = #"{"items":[{"id":"d1","other":{"username":"sara","displayName":"سارا","avatar":null},"counts":{"total":24,"mine":11,"theirs":13}}],"nextCursor":null}"#

    nonisolated static func items(_ items: [String], total: Int = 24, mine: Int = 11, theirs: Int = 13, next: String? = nil) -> String {
        let cursor = next.map { "\"\($0)\"" } ?? "null"
        return #"{"items":[\#(items.joined(separator: ","))],"nextCursor":\#(cursor),"counts":{"total":\#(total),"mine":\#(mine),"theirs":\#(theirs)}}"#
    }

    nonisolated static let hafez = MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: false, note: "یاد سفر شیراز افتادم", likedByMe: true, at: "2026-11-23T09:00:00Z")
    nonisolated static let saadi = MessageJSON.item(id: "i2", key: "/saadi/golestan/sh1#2", mine: true, likedByThem: true, at: "2026-11-21T09:00:00Z")
    nonisolated static let molana = MessageJSON.item(id: "i3", key: "/moulavi/masnavi/daftar1/sh1#0", mine: false, at: "2026-11-15T09:00:00Z")
    nonisolated static let hafez2 = MessageJSON.item(id: "i4", key: "/hafez/ghazal/sh9#1", mine: true, at: "2026-11-14T09:00:00Z")

    func model(_ handler: @escaping @Sendable (StubServer.Request) -> StubServer.Response) -> (SharedDivanModel, StubServer) {
        let stub = StubServer(handler)
        return (SharedDivanModel(username: "sara", session: signedInSession(stub.api)), stub)
    }

    /// The server of a divan: `by=me` and `by=them` filter, the counts always cover the whole divan.
    nonisolated static func server(_ request: StubServer.Request) -> StubServer.Response {
        switch (request.method, request.path) {
        case ("GET", "/v1/shared-divans"): return .json(200, divans)
        case ("GET", "/v1/shared-divans/d1/items"):
            if request.query.contains("by=me") { return .json(200, items([saadi, hafez2])) }
            if request.query.contains("by=them") { return .json(200, items([hafez, molana])) }
            return .json(200, items([hafez, saadi, molana, hafez2]))
        default: return .json(404, "{}")
        }
    }

    @Test func theDivanWithThePersonIsFoundAndItsCoupletsLoad() async {
        let (model, stub) = model(Self.server)
        await model.load()
        #expect(model.phase == .loaded)
        #expect(model.divan?.id == "d1")
        #expect(model.items.map(\.id) == ["i1", "i2", "i3", "i4"])
        #expect(model.counts == SharedDivanCounts(total: 24, mine: 11, theirs: 13))
        #expect(model.subtitle(name: "سارا") == "۲۴ بیت · سارا ۱۳، تو ۱۱")
        #expect(!stub.requests.contains { $0.method == "POST" })
    }

    @Test func aDivanThatDoesNotExistYetIsMadeAndANonFriendIsTold() async {
        let (model, stub) = model { request in
            switch (request.method, request.path) {
            case ("GET", "/v1/shared-divans"): .json(200, #"{"items":[],"nextCursor":null}"#)
            case ("POST", "/v1/shared-divans"): .json(200, #"{"id":"d1","other":{"username":"sara","displayName":"سارا","avatar":null},"counts":{"total":0,"mine":0,"theirs":0}}"#)
            case ("GET", "/v1/shared-divans/d1/items"): .json(200, Self.items([], total: 0, mine: 0, theirs: 0))
            default: .json(404, "{}")
            }
        }
        await model.load()
        #expect(model.phase == .loaded)
        #expect(model.items.isEmpty)
        #expect(stub.requests.contains { $0.method == "POST" && $0.path == "/v1/shared-divans" })
        let (refused, _) = self.model { request in
            request.method == "POST" ? .json(403, #"{"error":"forbidden"}"#) : .json(200, #"{"items":[],"nextCursor":null}"#)
        }
        await refused.load()
        #expect(refused.phase == .failed("فقط با دوستات می‌شه دیوان مشترک داشت"))
    }

    @Test func theChipsFilterByWhoAddedAndByPoet() async {
        let (model, stub) = model(Self.server)
        await model.load()
        #expect(model.poetSlugs == ["hafez", "saadi", "moulavi"])  // two of Hafez's, then in the order they come
        await model.select(.them)
        #expect(model.items.map(\.id) == ["i1", "i3"])
        #expect(model.counts == SharedDivanCounts(total: 24, mine: 11, theirs: 13))  // the counts cover the whole divan
        #expect(stub.requests.last?.query.contains("by=them") == true)
        await model.select(.me)
        #expect(model.items.map(\.id) == ["i2", "i4"])
        await model.select(.poet("hafez"))  // a poet is chosen among everyone's couplets
        #expect(model.items.count == 4)
        #expect(model.visibleItems.map(\.id) == ["i1", "i4"])
        let requests = stub.requests.count
        await model.select(.poet("saadi"))  // no new request between poets
        #expect(stub.requests.count == requests)
        #expect(model.visibleItems.map(\.id) == ["i2"])
        await model.select(.all)
        #expect(model.visibleItems.count == 4)
        #expect(model.poetSlugs == ["hafez", "saadi", "moulavi"])
    }

    @Test func morePagesAreAddedAtTheEnd() async {
        let (model, _) = model { request in
            switch request.path {
            case "/v1/shared-divans": return .json(200, Self.divans)
            default: return request.query.contains("cursor=p2") ? .json(200, Self.items([Self.molana])) : .json(200, Self.items([Self.hafez, Self.saadi], next: "p2"))
            }
        }
        await model.load()
        #expect(model.hasMore)
        await model.loadMore()
        #expect(model.items.map(\.id) == ["i1", "i2", "i3"])
        #expect(!model.hasMore)
    }

    @Test func likingIsAtOnceAndTheServerAnswerStands() async {
        let (model, stub) = model { request in
            switch (request.method, request.path) {
            case ("PUT", "/v1/shared-divans/d1/items/i2/like"): .json(200, MessageJSON.item(id: "i2", key: "/saadi/golestan/sh1#2", mine: true, likedByMe: true, likedByThem: true))
            case ("DELETE", "/v1/shared-divans/d1/items/i2/like"): .json(200, MessageJSON.item(id: "i2", key: "/saadi/golestan/sh1#2", mine: true, likedByMe: false, likedByThem: true))
            default: Self.server(request)
            }
        }
        await model.load()
        await model.toggleLike(model.items[1])
        #expect(model.items[1].likedByMe && model.items[1].likedByThem)
        await model.toggleLike(model.items[1])
        #expect(!model.items[1].likedByMe)
        #expect(stub.requests.filter { $0.path.hasSuffix("/like") }.map(\.method) == ["PUT", "DELETE"])
    }

    @Test func aLikeThatFailsIsTakenBack() async {
        let (model, _) = model { request in request.path.hasSuffix("/like") ? .offline : Self.server(request) }
        await model.load()
        await model.toggleLike(model.items[0])  // i1 was liked by me
        #expect(model.items[0].likedByMe)
        #expect(model.toast == APIError.network.persianMessage)
    }

    // MARK: Removing

    @Test func aCoupletIAddedIsTakenOutAtOnceAndTheServerIsAsked() async {
        let (model, stub) = model { request in request.method == "DELETE" ? .json(204, "") : Self.server(request) }
        await model.load()
        let task = Task { await model.remove(model.items[1]) }  // i2 is mine
        await Task.yield()  // the task runs as far as its request: the couplet is already out
        #expect(model.items.map(\.id) == ["i1", "i3", "i4"])
        #expect(model.counts == SharedDivanCounts(total: 23, mine: 10, theirs: 13))
        await task.value
        #expect(model.items.map(\.id) == ["i1", "i3", "i4"])
        #expect(model.toast == nil)
        #expect(stub.requests.filter { $0.method == "DELETE" }.map(\.path) == ["/v1/shared-divans/d1/items/i2"])
    }

    @Test func aRemovalThatFailsPutsTheCoupletBackWhereItWasAndShowsTheToast() async {
        let (model, _) = model { request in request.method == "DELETE" ? .offline : Self.server(request) }
        await model.load()
        await model.remove(model.items[1])
        #expect(model.items.map(\.id) == ["i1", "i2", "i3", "i4"])
        #expect(model.counts == SharedDivanCounts(total: 24, mine: 11, theirs: 13))
        #expect(model.toast == APIError.network.persianMessage)
    }

    @Test func aRemovalTheServerAnswers404ToStaysRemovedWithoutAToast() async {
        let (model, _) = model { request in request.method == "DELETE" ? .json(404, #"{"error":"not_found"}"#) : Self.server(request) }
        await model.load()
        await model.remove(model.items[1])  // it is already gone from the server
        #expect(model.items.map(\.id) == ["i1", "i3", "i4"])
        #expect(model.counts == SharedDivanCounts(total: 23, mine: 10, theirs: 13))
        #expect(model.toast == nil)
        // Any other refusal puts it back.
        let (refused, _) = self.model { request in request.method == "DELETE" ? .json(403, #"{"error":"forbidden"}"#) : Self.server(request) }
        await refused.load()
        await refused.remove(refused.items[1])
        #expect(refused.items.map(\.id) == ["i1", "i2", "i3", "i4"])
        #expect(refused.toast != nil)
    }

    @Test func onlyACoupletIAddedCanBeRemoved() async {
        let (model, stub) = model(Self.server)
        await model.load()
        await model.remove(model.items[0])  // i1 is hers
        #expect(model.items.map(\.id) == ["i1", "i2", "i3", "i4"])
        #expect(!stub.requests.contains { $0.method == "DELETE" })
        #expect(model.items.map(\.addedByMe) == [false, true, false, true])
    }

    @Test func aRemovedCoupletLeavesThePoetChipsThatNoLongerHaveOne() async {
        let (model, _) = model { request in request.method == "DELETE" ? .json(204, "") : Self.server(request) }
        await model.load()
        #expect(model.poetSlugs == ["hafez", "saadi", "moulavi"])
        await model.remove(model.items[1])  // the only couplet of Saadi
        #expect(model.poetSlugs == ["hafez", "moulavi"])
    }

    @Test func aCoupletTheOtherPersonAddsComesInAtTheTopAndMovesTheCounts() async throws {
        let (model, _) = model(Self.server)
        await model.load()
        let added = try JSONDecoder().decode(SharedDivanItem.self, from: Data(MessageJSON.item(id: "i9", key: "/hafez/ghazal/sh4#0", mine: false).utf8))
        model.apply(.divan(sharedDivanId: "d1", item: added))
        #expect(model.items.first?.id == "i9")
        #expect(model.counts == SharedDivanCounts(total: 25, mine: 11, theirs: 14))
        model.apply(.divan(sharedDivanId: "d1", item: added))  // the same event twice
        #expect(model.items.count == 5)
        #expect(model.counts?.total == 25)
        model.apply(.divan(sharedDivanId: "other", item: added))
        #expect(model.items.count == 5)
        // With «از من» on, their couplet only moves the counts.
        await model.select(.me)
        let again = try JSONDecoder().decode(SharedDivanItem.self, from: Data(MessageJSON.item(id: "i10", key: "/hafez/ghazal/sh5#0", mine: false).utf8))
        model.apply(.divan(sharedDivanId: "d1", item: again))
        #expect(model.items.map(\.id) == ["i2", "i4"])
        #expect(model.counts == SharedDivanCounts(total: 25, mine: 11, theirs: 14))  // the list read again (24), plus this one
    }

    @Test func aCoupletRemovedLiveLeavesTheListAndMovesTheCounts() async {
        let (model, stub) = model(Self.server)
        await model.load()
        model.apply(.divanRemoved(sharedDivanId: "other", itemId: "i1"))
        #expect(model.items.count == 4)
        model.apply(.divanRemoved(sharedDivanId: "d1", itemId: "i1"))  // hers
        #expect(model.items.map(\.id) == ["i2", "i3", "i4"])
        #expect(model.counts == SharedDivanCounts(total: 23, mine: 11, theirs: 12))
        model.apply(.divanRemoved(sharedDivanId: "d1", itemId: "i1"))  // the same event twice
        #expect(model.counts == SharedDivanCounts(total: 23, mine: 11, theirs: 12))
        #expect(stub.requests.filter { $0.path.hasSuffix("/items") }.count == 1)  // nothing read again
    }

    @Test func theLiveEventOfMyOwnRemovalCountsNothingTwice() async {
        let (model, _) = model { request in request.method == "DELETE" ? .json(204, "") : Self.server(request) }
        await model.load()
        await model.remove(model.items[1])
        model.apply(.divanRemoved(sharedDivanId: "d1", itemId: "i2"))
        #expect(model.counts == SharedDivanCounts(total: 23, mine: 10, theirs: 13))
        #expect(model.items.map(\.id) == ["i1", "i3", "i4"])
    }

    @Test func aCoupletRemovedLiveThatTheListDoesNotHoldReadsTheListAgain() async {
        let reads = Recorded<Int>()
        let (model, stub) = model { request in
            if request.method == "GET", request.path.hasSuffix("/items"), request.query.contains("by=me") {
                reads.add(1)  // the first read is before her removal, the next ones after it
                return .json(200, reads.all.count == 1 ? Self.items([Self.saadi, Self.hafez2]) : Self.items([Self.saadi, Self.hafez2], total: 23, mine: 11, theirs: 12))
            }
            return Self.server(request)
        }
        await model.load()
        await model.select(.me)  // «از من»: her couplets are not in the list, but the counts move
        let before = stub.requests.filter { $0.path.hasSuffix("/items") }.count
        model.apply(.divanRemoved(sharedDivanId: "d1", itemId: "i1"))
        for _ in 0..<100 where model.counts?.total != 23 { try? await Task.sleep(for: .milliseconds(20)) }
        #expect(model.counts == SharedDivanCounts(total: 23, mine: 11, theirs: 12))
        #expect(stub.requests.filter { $0.path.hasSuffix("/items") }.count == before + 1)
    }

    @Test func addingFromTheDivanReadsTheListAndTheCountsAgain() async throws {
        let posted = Recorded<String>()
        let (model, stub) = model { request in
            switch (request.method, request.path) {
            case ("POST", "/v1/shared-divans/d1/items"):
                posted.add("i9")
                return .json(201, MessageJSON.item(id: "i9", key: "/hafez/ghazal/sh3#0", mine: true, note: "یاد تو"))
            case ("GET", "/v1/shared-divans/d1/items") where !posted.all.isEmpty:
                return .json(200, Self.items([MessageJSON.item(id: "i9", key: "/hafez/ghazal/sh3#0", mine: true, note: "یاد تو"), Self.hafez], total: 25, mine: 12, theirs: 13))
            default:
                return Self.server(request)
            }
        }
        await model.load()
        await model.add(key: "/hafez/ghazal/sh3#0", note: " یاد تو ")
        #expect(model.items.first?.id == "i9")
        #expect(model.counts == SharedDivanCounts(total: 25, mine: 12, theirs: 13))
        #expect(stub.requests.first { $0.method == "POST" }?.json["note"] as? String == "یاد تو")
        // The live event of my own add arrives after the list was read: nothing is counted twice.
        let own = try JSONDecoder().decode(SharedDivanItem.self, from: Data(MessageJSON.item(id: "i9", key: "/hafez/ghazal/sh3#0", mine: true).utf8))
        model.apply(.divan(sharedDivanId: "d1", item: own))
        #expect(model.counts == SharedDivanCounts(total: 25, mine: 12, theirs: 13))
        #expect(model.items.filter { $0.id == "i9" }.count == 1)
    }

    @Test func aCoupletAlreadyThereIsNotCountedAgain() async {
        // The server answers 200 with the item that was there, and the counts stay as they were.
        let (model, _) = model { request in
            request.method == "POST" ? .json(200, MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: false)) : Self.server(request)
        }
        await model.load()
        await model.add(key: "/hafez/ghazal/sh3#0", note: nil)
        #expect(model.counts == SharedDivanCounts(total: 24, mine: 11, theirs: 13))
        #expect(model.items.count == 4)
    }

    @Test func aRefusedAddSaysWhy() async {
        let (model, _) = model { request in
            request.method == "POST" ? .json(403, #"{"error":"forbidden"}"#) : Self.server(request)
        }
        await model.load()
        await model.add(key: "/hafez/ghazal/sh4#0", note: nil)
        #expect(model.toast == "فقط با دوستات می‌شه دیوان مشترک داشت")
        #expect(model.items.count == 4)
    }

    @Test func aNoteIsCutAtTwoHundredUTF16Units() async {
        let (model, stub) = model { request in
            request.method == "POST" ? .json(201, MessageJSON.item(id: "i9", key: "/hafez/ghazal/sh3#0", mine: true)) : Self.server(request)
        }
        await model.load()
        await model.add(key: "/hafez/ghazal/sh3#0", note: String(repeating: "😀", count: 150))
        #expect((stub.requests.first { $0.method == "POST" }?.json["note"] as? String)?.utf16.count == 200)
    }

    // MARK: «به دیوان مشترک» in the hold menu

    func adder(person: ChatPerson? = nil, _ handler: @escaping @Sendable (StubServer.Request) -> StubServer.Response) -> (SharedDivanAdder, StubServer) {
        let stub = StubServer(handler)
        return (SharedDivanAdder(target: SharedDivanTarget(key: "/hafez/ghazal/sh3#0", person: person), session: signedInSession(stub.api)), stub)
    }

    nonisolated static let friends = #"{"items":[{"username":"sara","displayName":"سارا","avatar":null},{"username":"kian","displayName":"کیان","avatar":null},{"username":"mahsa","displayName":null,"avatar":null}],"nextCursor":null}"#

    @Test func theSheetListsFriendsWithADivanAndThenTheOtherFriends() async {
        let (adder, _) = adder { request in
            switch request.path {
            case "/v1/shared-divans": .json(200, Self.divans)
            case "/v1/me/friends": .json(200, Self.friends)
            default: .json(404, "{}")
            }
        }
        await adder.load()
        #expect(adder.divans.map(\.other.username) == ["sara"])
        #expect(!adder.showsFriends)
        await adder.showFriends()
        #expect(adder.showsFriends)
        #expect(adder.friends.map(\.username) == ["kian", "mahsa"])  // Sara already has a divan, listed above
    }

    @Test func addingToAnExistingDivanPostsTheCoupletWithTheNote() async throws {
        let (adder, stub) = adder { request in
            switch (request.method, request.path) {
            case ("GET", "/v1/shared-divans"): .json(200, Self.divans)
            case ("POST", "/v1/shared-divans/d1/items"): .json(201, MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: true))
            default: .json(404, "{}")
            }
        }
        await adder.load()
        adder.chosen = adder.divans[0].other
        adder.note = "  یاد تو افتادم  "
        #expect(await adder.add())
        #expect(adder.phase == .done("به دیوان من و سارا اضافه شد"))
        let post = try #require(stub.requests.first { $0.method == "POST" })
        #expect(post.path == "/v1/shared-divans/d1/items")
        #expect(post.json["key"] as? String == "/hafez/ghazal/sh3#0")
        #expect(post.json["note"] as? String == "یاد تو افتادم")
        #expect(!stub.requests.contains { $0.method == "POST" && $0.path == "/v1/shared-divans" })
    }

    @Test func aFriendWithoutADivanGetsOneMadeFirstAndNoNoteIsLeftOut() async {
        let kian = ChatPerson(username: "kian", displayName: "کیان", avatar: nil, online: nil)
        let (adder, stub) = adder(person: kian) { request in
            switch (request.method, request.path) {
            case ("POST", "/v1/shared-divans"): .json(200, #"{"id":"d2","other":{"username":"kian","displayName":"کیان","avatar":null},"counts":{"total":0,"mine":0,"theirs":0}}"#)
            case ("POST", "/v1/shared-divans/d2/items"): .json(201, MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: true))
            default: .json(404, "{}")
            }
        }
        await adder.load()  // from a chat nobody needs to be listed
        #expect(stub.requests.isEmpty)
        #expect(await adder.add())
        #expect(adder.phase == .done("به دیوان من و کیان اضافه شد"))
        #expect(stub.requests.map(\.path) == ["/v1/shared-divans", "/v1/shared-divans/d2/items"])
        #expect(stub.requests[1].json["note"] == nil)
    }

    @Test func aNonFriendIsToldWithTheLeadsLineAndCanTryAgain() async {
        let stranger = ChatPerson(username: "stranger", displayName: nil, avatar: nil, online: nil)
        let (adder, stub) = adder(person: stranger) { _ in .json(403, #"{"error":"forbidden"}"#) }
        #expect(!(await adder.add()))
        #expect(adder.failure == "فقط با دوستات می‌شه دیوان مشترک داشت")
        #expect(adder.phase == .choosing)
        stub.respond { request in
            request.path == "/v1/shared-divans" ? .json(200, #"{"id":"d3","other":{"username":"stranger","displayName":null,"avatar":null},"counts":{"total":0,"mine":0,"theirs":0}}"#) : .json(201, MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: true))
        }
        #expect(await adder.add())
        #expect(adder.failure == nil)
    }

    @Test func theSheetsNoteIsCutAtTwoHundredUTF16Units() async {
        let kian = ChatPerson(username: "kian", displayName: "کیان", avatar: nil, online: nil)
        let (adder, stub) = adder(person: kian) { request in
            request.path == "/v1/shared-divans" ? .json(200, #"{"id":"d2","other":{"username":"kian","displayName":"کیان","avatar":null},"counts":{"total":0,"mine":0,"theirs":0}}"#) : .json(201, MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: true))
        }
        adder.note = String(repeating: "😀", count: 150)
        await adder.add()
        #expect((stub.requests.last?.json["note"] as? String)?.utf16.count == 200)
    }

    @Test func nothingIsAddedUntilSomeoneIsChosen() async {
        let (adder, stub) = adder { _ in .json(404, "{}") }
        #expect(!(await adder.add()))
        #expect(stub.requests.isEmpty)
    }

    @Test func theDaysOfTheCardsAreWrittenAsOnTheBoard() {
        let calendar = MessageClock.calendar
        func line(_ iso: String) -> String { ChatTime.added(MessageClock.date(iso), now: MessageClock.now, calendar: calendar) }
        #expect(line("2026-11-24T08:00:00Z") == "امروز")
        #expect(line("2026-11-23T08:00:00Z") == "دیروز")
        #expect(line("2026-11-21T08:00:00Z") == "۳ روز پیش")
        #expect(line("2026-11-15T08:00:00Z") == "هفته‌ی پیش")
        #expect(line("2026-10-01T08:00:00Z") == "۹ مهر")
    }
}
