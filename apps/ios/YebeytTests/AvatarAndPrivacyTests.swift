import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct AvatarTests {
    private func defaults() -> UserDefaults { UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")! }

    // MARK: Catalogue

    @Test func everyoneStartsWithTheBoardsFace() {
        #expect(AvatarParts.standard == AvatarParts(face: "peach", eyes: "round", hair: "dark", mouth: "smile", accessory: "ney", background: "sun"))
        #expect(AvatarCatalogue.isValid(.standard))
        #expect(AvatarCatalogue.skin("peach") == 0xF2C29B)
        #expect(AvatarCatalogue.hair("dark") == 0x3B2A2A)
        #expect(AvatarCatalogue.background("sun") == 0xFFE08A)
    }

    @Test func theBoardsSixAccessoriesInOrder() {
        #expect(Accessory.allCases.map(\.title) == ["هیچی", "نیِ مولانا", "گل سرخِ حافظ", "تاجِ شاهنامه", "کلاه‌خودِ رستم", "شمع و پروانه"])
        #expect(AvatarCatalogue.options(for: .accessory).count == 6)
    }

    @Test func theSpokenFaceMentionsTheAccessory() {
        #expect(AvatarParts.standard.spoken == "چهره‌ی تو، با نیِ مولانا")
        var bare = AvatarParts.standard
        bare.accessory = "none"
        #expect(bare.spoken == "چهره‌ی تو")
    }

    @Test func eyesAndMouthHaveThreeVariantsAndTheChipsAreTheBoards() {
        #expect(AvatarCatalogue.options(for: .eyes).count == 3)
        #expect(AvatarCatalogue.options(for: .mouth).count == 3)
        #expect(AvatarPart.allCases.map(\.title) == ["صورت", "چشم", "مو", "دهن", "کلاه و همراه", "زمینه"])
    }

    @Test func everyIdFitsTheContractsShape() {
        let shape = #/^[a-z0-9-]{1,32}$/#
        for part in AvatarPart.allCases {
            for option in AvatarCatalogue.options(for: part) {
                #expect(option.id.wholeMatch(of: shape) != nil, "\(part): \(option.id)")
            }
        }
    }

    @Test func aFaceWithAnUnknownPartIsNotValid() {
        var parts = AvatarParts.standard
        parts.eyes = "laser"
        #expect(!AvatarCatalogue.isValid(parts))
    }

    // MARK: Locks

    @Test func theFirstThreeAreOpenTheCrownNeedsFiveBookWinsTheCandleASevenDayStreak() {
        let none = AvatarProgress()
        #expect([Accessory.none, .ney, .rose].allSatisfy { $0.isUnlocked(none) })
        #expect(!Accessory.crown.isUnlocked(AvatarProgress(bookWins: 4)))
        #expect(Accessory.crown.isUnlocked(AvatarProgress(bookWins: 5)))
        #expect(!Accessory.candle.isUnlocked(AvatarProgress(bestStreak: 6)))
        #expect(Accessory.candle.isUnlocked(AvatarProgress(bestStreak: 7)))
    }

    @Test func theHelmetStaysLockedWhateverIsDone() {
        #expect(!Accessory.helmet.isUnlocked(AvatarProgress(bookWins: 999, bestStreak: 999)))
    }

    @Test func lockedItemsShowTheBoardsUnlockText() {
        #expect(Accessory.crown.unlockText == "۵ برد توی «از کدوم کتاب؟»")
        #expect(Accessory.helmet.unlockText == "لیگ سخن‌دان")
        #expect(Accessory.candle.unlockText == "۷ روز پشت‌سرهم")
        #expect(Accessory.ney.unlockText == nil)
    }

    @Test func aLockedAccessoryCannotBeChosenAnOpenOneCan() {
        let progress = AvatarProgress()
        #expect(AvatarCatalogue.choosing("crown", for: .accessory, in: .standard, progress: progress) == nil)
        #expect(AvatarCatalogue.choosing("crown", for: .accessory, in: .standard, progress: AvatarProgress(bookWins: 5))?.accessory == "crown")
        #expect(AvatarCatalogue.choosing("rose", for: .accessory, in: .standard, progress: progress)?.accessory == "rose")
        #expect(AvatarCatalogue.choosing("happy", for: .eyes, in: .standard, progress: progress)?.eyes == "happy")
        #expect(AvatarCatalogue.choosing("laser", for: .eyes, in: .standard, progress: progress) == nil)
    }

    // MARK: Store

    private struct Fixture {
        var store: AvatarStore
        var stub: StubServer
        var keychain: KeychainStore
        var defaults: UserDefaults
    }

    private func fixture(signedIn: Bool, defaults: UserDefaults? = nil) -> Fixture {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        if signedIn { keychain.write("r0") }
        let stub = StubServer { request in
            switch request.path {
            case "/v1/auth/refresh": .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar"))
            case "/v1/me/avatar": .json(200, StubJSON.user(username: "niloofar"))
            default: .json(404, "{}")
            }
        }
        let defaults = defaults ?? self.defaults()
        return Fixture(store: AvatarStore(session: Session(api: stub.api, store: keychain), defaults: defaults), stub: stub, keychain: keychain, defaults: defaults)
    }

    @Test func theStandardFaceAtFirst() {
        let f = fixture(signedIn: false)
        #expect(f.store.parts == .standard)
    }

    @Test func aSavedFaceStaysOnThePhoneAndAGuestSendsNothing() async {
        let f = fixture(signedIn: false)
        var parts = AvatarParts.standard
        parts.hair = "fire"
        parts.accessory = "rose"
        f.store.save(parts)
        await f.store.flush()
        #expect(f.store.parts == parts)
        #expect(f.stub.requests.isEmpty)
        #expect(AvatarStore(session: Session(api: f.stub.api, store: f.keychain), defaults: f.defaults).parts == parts)
    }

    @Test func savingWhileSignedInSendsTheSixPartsToTheServer() async throws {
        let f = fixture(signedIn: true)
        defer { f.keychain.delete() }
        var parts = AvatarParts.standard
        parts.mouth = "grin"
        f.store.save(parts)
        #expect(f.store.parts == parts)  // saved at once, before anything is sent
        await f.store.flush()
        let put = try #require(f.stub.requests(to: "/v1/me/avatar").first)
        #expect(put.method == "PUT")
        #expect(put.authorization == "Bearer a1")
        #expect(put.json as? [String: String] == ["face": "peach", "eyes": "round", "hair": "dark", "mouth": "grin", "accessory": "ney", "background": "sun"])
    }

    @Test func aSavedFaceThatIsNotInTheCatalogueFallsBackToTheStandardOne() throws {
        let defaults = defaults()
        var bad = AvatarParts.standard
        bad.face = "purple"
        defaults.set(try JSONEncoder().encode(bad), forKey: AvatarStore.defaultsKey)
        #expect(fixture(signedIn: false, defaults: defaults).store.parts == .standard)
    }

    @Test func theServersFaceIsTakenWhenThePhoneHasNeverChangedOne() async {
        let f = fixture(signedIn: true)
        defer { f.keychain.delete() }
        var remote = AvatarParts.standard
        remote.background = "mint"
        await f.store.reconcile(with: APIUser(id: "u", username: "a", displayName: nil, usernameChangedAt: nil, createdAt: "2026-11-23T08:00:00.000Z", providers: [.apple], avatar: remote))
        #expect(f.store.parts == remote)
        #expect(f.stub.requests(to: "/v1/me/avatar").isEmpty)
    }

    @Test func aFaceMadeOnThePhoneGoesUpWhenTheServerHasNone() async {
        let f = fixture(signedIn: true)
        defer { f.keychain.delete() }
        var mine = AvatarParts.standard
        mine.eyes = "wink"
        f.stub.respond { _ in .offline }
        f.store.save(mine)
        await f.store.flush()
        #expect(f.store.isUnsent)  // the server did not take it
        f.stub.respond { request in
            request.path == "/v1/auth/refresh" ? .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar")) : .json(200, StubJSON.user(username: "niloofar"))
        }
        let before = f.stub.requests(to: "/v1/me/avatar").count
        await f.store.reconcile(with: APIUser(id: "u", username: "a", displayName: nil, usernameChangedAt: nil, createdAt: "2026-11-23T08:00:00.000Z", providers: [.apple], avatar: nil))
        #expect(f.stub.requests(to: "/v1/me/avatar").count == before + 1)
        #expect(f.store.parts == mine)
        #expect(!f.store.isUnsent)  // sent now
    }

    /// A server that keeps the face of the account, answering as the real one does.
    private final class FaceServer: @unchecked Sendable {
        private let lock = NSLock()
        private(set) var face: AvatarParts?
        func handle(_ request: StubServer.Request) -> StubServer.Response {
            if request.path == "/v1/auth/refresh" { return .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar")) }
            guard request.path == "/v1/me/avatar", request.method == "PUT" else { return .json(404, "{}") }
            lock.withLock { face = try? JSONDecoder().decode(AvatarParts.self, from: request.body) }
            return .json(200, StubJSON.user(username: "niloofar"))
        }
        var user: APIUser {
            APIUser(id: "u", username: "niloofar", displayName: nil, usernameChangedAt: nil, createdAt: "2026-11-23T08:00:00.000Z", providers: [.apple], avatar: lock.withLock { face })
        }
    }

    private func device(_ server: FaceServer) -> (store: AvatarStore, stub: StubServer, keychain: KeychainStore) {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        keychain.write("r0")
        let stub = StubServer { server.handle($0) }
        return (AvatarStore(session: Session(api: stub.api, store: keychain), defaults: defaults()), stub, keychain)
    }

    @Test func aFaceChangedOnAnotherPhoneIsNotOverwrittenByAnOldOneHere() async {
        let server = FaceServer()
        let a = device(server), b = device(server)
        defer { a.keychain.delete(); b.keychain.delete() }
        var old = AvatarParts.standard
        old.hair = "lapis"
        b.store.save(old)
        await b.store.flush()  // the phone B's face reached the server
        #expect(!b.store.isUnsent)

        var newer = AvatarParts.standard
        newer.background = "mint"
        a.store.save(newer)  // changed on phone A later
        await a.store.flush()
        #expect(server.face == newer)

        await b.store.reconcile(with: server.user)  // B comes back
        #expect(b.store.parts == newer)  // it takes the server's face ...
        #expect(server.face == newer)  // ... and sends nothing
        #expect(b.stub.requests(to: "/v1/me/avatar").count == 1)
    }

    @Test func aFaceSavedButNeverReceivedIsSentBeforeTheServersFaceIsTaken() async {
        let server = FaceServer()
        let a = device(server)
        defer { a.keychain.delete() }
        var remote = AvatarParts.standard
        remote.background = "rose"
        var mine = AvatarParts.standard
        mine.eyes = "happy"
        a.stub.respond { _ in .offline }
        a.store.save(mine)
        await a.store.flush()
        #expect(a.store.isUnsent)
        a.stub.respond { server.handle($0) }
        var user = server.user
        user.avatar = remote  // another phone saved a different face meanwhile
        await a.store.reconcile(with: user)
        #expect(a.store.parts == mine)
        #expect(server.face == mine)
        #expect(!a.store.isUnsent)
    }

    @Test func clearingGoesBackToTheStandardFace() async {
        let f = fixture(signedIn: false)
        var parts = AvatarParts.standard
        parts.face = "tan"
        f.store.save(parts)
        f.store.clear()
        #expect(!f.store.isUnsent)
        #expect(f.store.parts == .standard)
        #expect(AvatarStore(session: Session(api: f.stub.api, store: f.keychain), defaults: f.defaults).parts == .standard)
    }
}

@MainActor
struct PrivacyTests {
    private func defaults() -> UserDefaults { UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")! }

    private struct Fixture {
        var store: PrivacyStore
        var stub: StubServer
        var keychain: KeychainStore
        var defaults: UserDefaults
    }

    private func fixture(signedIn: Bool, remote: String = #"{"keptVisibility":"me","dailyVisibility":"friends","showOnline":false,"inGlobalLeaderboard":true,"messagesFrom":"all","gameInvitesFrom":"friends","allowReposts":false}"#) -> Fixture {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        if signedIn { keychain.write("r0") }
        let stub = StubServer { request in
            switch request.path {
            case "/v1/auth/refresh": .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar"))
            case "/v1/me/privacy": .json(200, remote)
            default: .json(404, "{}")
            }
        }
        let defaults = defaults()
        return Fixture(store: PrivacyStore(session: Session(api: stub.api, store: keychain), defaults: defaults), stub: stub, keychain: keychain, defaults: defaults)
    }

    @Test func theDefaultsAreTheBoardsSelection() {
        let settings = PrivacySettings()
        #expect(settings.keptVisibility == .friends)
        #expect(settings.dailyVisibility == .friends)
        #expect(settings.showOnline)
        #expect(!settings.inGlobalLeaderboard)
        #expect(settings.messagesFrom == .friends)
        #expect(settings.gameInvitesFrom == .all)
        #expect(settings.allowReposts)
    }

    @Test func aChangeIsKeptOnThePhoneAndSurvivesARestart() {
        let f = fixture(signedIn: false)
        f.store.set(\.keptVisibility, to: .me)
        f.store.set(\.showOnline, to: false)
        #expect(f.store.settings.keptVisibility == .me)
        let reopened = PrivacyStore(session: Session(api: f.stub.api, store: f.keychain), defaults: f.defaults)
        #expect(reopened.settings.keptVisibility == .me)
        #expect(!reopened.settings.showOnline)
        #expect(reopened.settings.messagesFrom == .friends)
        #expect(f.stub.requests.isEmpty)  // a guest sends nothing
    }

    @Test func eachChangeIsSentAsAPartialUpdateInOrder() async throws {
        let f = fixture(signedIn: true)
        defer { f.keychain.delete() }
        f.store.set(\.messagesFrom, to: .all)
        await f.store.flush()
        f.store.set(\.allowReposts, to: false)
        f.store.set(\.allowReposts, to: false)  // no change: nothing sent
        await f.store.flush()
        let puts = f.stub.requests(to: "/v1/me/privacy").filter { $0.method == "PUT" }
        #expect(puts.count == 2)
        #expect(puts[0].json as? [String: String] == ["messagesFrom": "all"])
        #expect(puts[1].json.count == 1 && puts[1].json["allowReposts"] as? Bool == false)
        #expect(puts[0].authorization == "Bearer a1")
    }

    @Test func openingTheScreenTakesTheServersSettings() async {
        let f = fixture(signedIn: true)
        defer { f.keychain.delete() }
        await f.store.refresh()
        #expect(f.store.settings == PrivacySettings(
            keptVisibility: .me, dailyVisibility: .friends, showOnline: false, inGlobalLeaderboard: true,
            messagesFrom: .all, gameInvitesFrom: .friends, allowReposts: false
        ))
        #expect(f.stub.requests(to: "/v1/me/privacy").first?.method == "GET")
    }

    @Test func aGuestOrAnOfflinePhoneKeepsItsOwnSettings() async {
        let guest = fixture(signedIn: false)
        await guest.store.refresh()
        #expect(guest.store.settings == PrivacySettings())
        #expect(guest.stub.requests.isEmpty)

        let offline = fixture(signedIn: true)
        defer { offline.keychain.delete() }
        offline.stub.respond { _ in .offline }
        offline.store.set(\.showOnline, to: false)
        await offline.store.refresh()
        #expect(!offline.store.settings.showOnline)
    }

    @Test func changesNotYetReceivedAreKeptSentFirstAndNotOverwrittenByTheServer() async throws {
        let f = fixture(signedIn: true)
        defer { f.keychain.delete() }
        let remote = #"{"keptVisibility":"friends","dailyVisibility":"me","showOnline":true,"inGlobalLeaderboard":false,"messagesFrom":"friends","gameInvitesFrom":"all","allowReposts":true}"#
        f.stub.respond { _ in .offline }
        f.store.set(\.keptVisibility, to: .me)
        f.store.set(\.showOnline, to: false)
        await f.store.refresh()
        #expect(f.store.hasUnsentChanges)
        #expect(f.store.settings.keptVisibility == .me && !f.store.settings.showOnline)  // the server's values are not taken
        // The unsent changes survive a restart.
        let restarted = PrivacyStore(session: Session(api: f.stub.api, store: f.keychain), defaults: f.defaults)
        #expect(restarted.hasUnsentChanges)

        // Back online: they are sent first (one update, both fields), then the server's other settings come down.
        f.stub.respond { request in
            switch request.path {
            case "/v1/auth/refresh": .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar"))
            default: .json(200, remote)
            }
        }
        await restarted.refresh()
        let calls = f.stub.requests(to: "/v1/me/privacy").map(\.method)
        #expect(Array(calls.suffix(2)) == ["PUT", "GET"])
        let put = try #require(f.stub.requests(to: "/v1/me/privacy").last { $0.method == "PUT" })
        #expect(put.json.count == 2 && put.json["keptVisibility"] as? String == "me" && put.json["showOnline"] as? Bool == false)
        #expect(!restarted.hasUnsentChanges)
        #expect(restarted.settings.dailyVisibility == .me)  // from the server
    }

    @Test func aFieldChangedAgainWhileItWasBeingSentStaysUnsent() {
        let sent = PrivacyPatch(from: PrivacySettings(), to: { var s = PrivacySettings(); s.showOnline = false; s.allowReposts = false; return s }())
        var unsent = sent
        unsent.showOnline = true  // changed back after the send began
        let left = unsent.removing(sent: sent)
        #expect(left.showOnline == true && left.allowReposts == nil)
    }

    @Test func clearingGoesBackToTheDefaults() {
        let f = fixture(signedIn: false)
        f.store.set(\.inGlobalLeaderboard, to: true)
        f.store.clear()
        #expect(f.store.settings == PrivacySettings())
        #expect(PrivacyStore(session: Session(api: f.stub.api, store: f.keychain), defaults: f.defaults).settings == PrivacySettings())
    }
}
