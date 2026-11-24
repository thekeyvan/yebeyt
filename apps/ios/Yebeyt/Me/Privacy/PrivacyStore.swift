import Foundation
import Observation

/// `PrivacySettings` of the contract. The defaults are the board's selection (and the server's).
struct PrivacySettings: Codable, Equatable, Sendable {
    enum Visibility: String, Codable, Sendable { case friends, me }
    enum Audience: String, Codable, Sendable { case all, friends }

    var keptVisibility = Visibility.friends
    var dailyVisibility = Visibility.friends
    var showOnline = true
    var inGlobalLeaderboard = false
    var messagesFrom = Audience.friends
    var gameInvitesFrom = Audience.all
    var allowReposts = true
}

/// `PrivacyPatch`: only the fields that changed.
struct PrivacyPatch: Codable, Equatable, Sendable {
    var keptVisibility: PrivacySettings.Visibility?
    var dailyVisibility: PrivacySettings.Visibility?
    var showOnline: Bool?
    var inGlobalLeaderboard: Bool?
    var messagesFrom: PrivacySettings.Audience?
    var gameInvitesFrom: PrivacySettings.Audience?
    var allowReposts: Bool?

    init() {}

    init(from old: PrivacySettings, to new: PrivacySettings) {
        keptVisibility = old.keptVisibility == new.keptVisibility ? nil : new.keptVisibility
        dailyVisibility = old.dailyVisibility == new.dailyVisibility ? nil : new.dailyVisibility
        showOnline = old.showOnline == new.showOnline ? nil : new.showOnline
        inGlobalLeaderboard = old.inGlobalLeaderboard == new.inGlobalLeaderboard ? nil : new.inGlobalLeaderboard
        messagesFrom = old.messagesFrom == new.messagesFrom ? nil : new.messagesFrom
        gameInvitesFrom = old.gameInvitesFrom == new.gameInvitesFrom ? nil : new.gameInvitesFrom
        allowReposts = old.allowReposts == new.allowReposts ? nil : new.allowReposts
    }

    var isEmpty: Bool { self == PrivacyPatch() }

    /// The fields of `other` win where both have one.
    func merged(with other: PrivacyPatch) -> PrivacyPatch {
        var result = self
        result.keptVisibility = other.keptVisibility ?? keptVisibility
        result.dailyVisibility = other.dailyVisibility ?? dailyVisibility
        result.showOnline = other.showOnline ?? showOnline
        result.inGlobalLeaderboard = other.inGlobalLeaderboard ?? inGlobalLeaderboard
        result.messagesFrom = other.messagesFrom ?? messagesFrom
        result.gameInvitesFrom = other.gameInvitesFrom ?? gameInvitesFrom
        result.allowReposts = other.allowReposts ?? allowReposts
        return result
    }

    /// Without the fields that still hold the value that `sent` carried (a field changed again meanwhile stays).
    func removing(sent: PrivacyPatch) -> PrivacyPatch {
        var result = self
        if keptVisibility == sent.keptVisibility { result.keptVisibility = nil }
        if dailyVisibility == sent.dailyVisibility { result.dailyVisibility = nil }
        if showOnline == sent.showOnline { result.showOnline = nil }
        if inGlobalLeaderboard == sent.inGlobalLeaderboard { result.inGlobalLeaderboard = nil }
        if messagesFrom == sent.messagesFrom { result.messagesFrom = nil }
        if gameInvitesFrom == sent.gameInvitesFrom { result.gameInvitesFrom = nil }
        if allowReposts == sent.allowReposts { result.allowReposts = nil }
        return result
    }
}

/// The privacy settings: kept on the phone, and with an account also on the server. A change is saved at once and
/// stays in an «unsent» patch (kept on the phone) until the server has taken it. When the screen opens, the unsent
/// changes are sent first; the server's settings are taken only when nothing is unsent.
@MainActor @Observable
final class PrivacyStore {
    static let defaultsKey = "me.privacy"
    static let unsentKey = "me.privacy.unsent"

    private(set) var settings: PrivacySettings
    @ObservationIgnored private var unsent: PrivacyPatch
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var lastPush: Task<Void, Never>?

    init(session: Session, defaults: UserDefaults = .standard) {
        self.session = session
        self.defaults = defaults
        settings = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode(PrivacySettings.self, from: $0) } ?? PrivacySettings()
        unsent = defaults.data(forKey: Self.unsentKey).flatMap { try? JSONDecoder().decode(PrivacyPatch.self, from: $0) } ?? PrivacyPatch()
    }

    var hasUnsentChanges: Bool { !unsent.isEmpty }

    /// Changes one setting: saved at once, then sent to the server in the background.
    func set<Value: Equatable>(_ keyPath: WritableKeyPath<PrivacySettings, Value>, to value: Value) {
        var new = settings
        new[keyPath: keyPath] = value
        let patch = PrivacyPatch(from: settings, to: new)
        guard !patch.isEmpty else { return }
        settings = new
        unsent = unsent.merged(with: patch)
        save()
        guard session.isSignedIn else { return }
        let previous = lastPush
        lastPush = Task { [self] in
            await previous?.value
            _ = await push()
        }
    }

    /// When the screen opens: unsent changes go up first; then, if none are left, the server's settings replace the
    /// phone's. Without an account, or offline, nothing changes.
    func refresh() async {
        guard session.isSignedIn else { return }
        await flush()
        guard !hasUnsentChanges else { return }
        let session = session
        let api = session.api
        guard let remote = try? await session.authorized({ try await api.privacy(token: $0) }) else { return }
        guard !hasUnsentChanges else { return }  // changed while the answer was on its way
        settings = remote
        save()
    }

    /// Waits for a send that is on its way (without sending anything new).
    func settle() async {
        await lastPush?.value
    }

    /// Sends what is unsent and waits for it (before signing out, and for tests).
    func flush() async {
        await lastPush?.value
        if session.isSignedIn { _ = await push() }
    }

    /// After the account is deleted or signed out of: the defaults again.
    func clear() {
        settings = PrivacySettings()
        unsent = PrivacyPatch()
        defaults.removeObject(forKey: Self.defaultsKey)
        defaults.removeObject(forKey: Self.unsentKey)
    }

    private func push() async -> Bool {
        let sending = unsent
        guard !sending.isEmpty else { return true }
        let session = session
        let api = session.api
        do {
            _ = try await session.authorized { try await api.putPrivacy(sending, token: $0) }
        } catch {
            return false
        }
        unsent = unsent.removing(sent: sending)
        save()
        return true
    }

    private func save() {
        if let data = try? JSONEncoder().encode(settings) { defaults.set(data, forKey: Self.defaultsKey) }
        if let data = try? JSONEncoder().encode(unsent) { defaults.set(data, forKey: Self.unsentKey) }
    }
}
