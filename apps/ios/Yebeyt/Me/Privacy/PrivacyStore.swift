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
struct PrivacyPatch: Encodable, Equatable, Sendable {
    var keptVisibility: PrivacySettings.Visibility?
    var dailyVisibility: PrivacySettings.Visibility?
    var showOnline: Bool?
    var inGlobalLeaderboard: Bool?
    var messagesFrom: PrivacySettings.Audience?
    var gameInvitesFrom: PrivacySettings.Audience?
    var allowReposts: Bool?

    init(from old: PrivacySettings, to new: PrivacySettings) {
        keptVisibility = old.keptVisibility == new.keptVisibility ? nil : new.keptVisibility
        dailyVisibility = old.dailyVisibility == new.dailyVisibility ? nil : new.dailyVisibility
        showOnline = old.showOnline == new.showOnline ? nil : new.showOnline
        inGlobalLeaderboard = old.inGlobalLeaderboard == new.inGlobalLeaderboard ? nil : new.inGlobalLeaderboard
        messagesFrom = old.messagesFrom == new.messagesFrom ? nil : new.messagesFrom
        gameInvitesFrom = old.gameInvitesFrom == new.gameInvitesFrom ? nil : new.gameInvitesFrom
        allowReposts = old.allowReposts == new.allowReposts ? nil : new.allowReposts
    }

    var isEmpty: Bool {
        keptVisibility == nil && dailyVisibility == nil && showOnline == nil && inGlobalLeaderboard == nil
            && messagesFrom == nil && gameInvitesFrom == nil && allowReposts == nil
    }
}

/// The privacy settings: kept on the phone, and with an account also on the server (read when the screen opens,
/// each change sent as it is made). Most of them take effect once friends and messages exist (slices 7 and 8).
@MainActor @Observable
final class PrivacyStore {
    static let defaultsKey = "me.privacy"

    private(set) var settings: PrivacySettings
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var lastPush: Task<Void, Never>?

    init(session: Session, defaults: UserDefaults = .standard) {
        self.session = session
        self.defaults = defaults
        settings = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode(PrivacySettings.self, from: $0) } ?? PrivacySettings()
    }

    /// Changes one setting: saved at once, then sent to the server in the order the changes were made.
    func set<Value: Equatable>(_ keyPath: WritableKeyPath<PrivacySettings, Value>, to value: Value) {
        var new = settings
        new[keyPath: keyPath] = value
        let patch = PrivacyPatch(from: settings, to: new)
        guard !patch.isEmpty else { return }
        settings = new
        save()
        guard session.isSignedIn else { return }
        let previous = lastPush
        let session = session
        lastPush = Task {
            await previous?.value
            let api = session.api
            _ = try? await session.authorized { try await api.putPrivacy(patch, token: $0) }
        }
    }

    /// When the screen opens: the server's settings replace the phone's. Without an account, or offline, nothing changes.
    func refresh() async {
        guard session.isSignedIn else { return }
        await lastPush?.value
        let api = session.api
        guard let remote = try? await session.authorized({ try await api.privacy(token: $0) }) else { return }
        settings = remote
        save()
    }

    /// After the account is deleted: the defaults again.
    func clear() {
        settings = PrivacySettings()
        defaults.removeObject(forKey: Self.defaultsKey)
    }

    /// Waits for the changes sent so far (for tests).
    func waitForPushes() async {
        await lastPush?.value
    }

    private func save() {
        if let data = try? JSONEncoder().encode(settings) { defaults.set(data, forKey: Self.defaultsKey) }
    }
}
