import Foundation
import Observation

/// The face: kept on the phone (every guest has one) and, for a signed-in person, on the server. «ذخیره» saves it
/// here at once and sends it in the background. A face that is saved but not yet received by the server is
/// «unsent» (kept on the phone until a send succeeds). When someone signs in or the app starts: an unsent face
/// goes up; otherwise the server's face comes down, so a face changed on another phone is not overwritten by an
/// old one here.
@MainActor @Observable
final class AvatarStore {
    static let defaultsKey = "me.avatar"
    static let unsentKey = "me.avatar.unsent"

    private(set) var parts: AvatarParts
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var lastSend: Task<Void, Never>?

    init(session: Session, defaults: UserDefaults = .standard) {
        self.session = session
        self.defaults = defaults
        let saved = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode(AvatarParts.self, from: $0) }
        parts = saved.flatMap { AvatarCatalogue.isValid($0) ? $0 : nil } ?? .standard
    }

    var isUnsent: Bool { defaults.bool(forKey: Self.unsentKey) }

    /// Saves the face here and sends it in the background (when signed in).
    func save(_ new: AvatarParts) {
        parts = new
        store(new)
        defaults.set(true, forKey: Self.unsentKey)
        queueSend()
    }

    /// With the user the server knows: an unsent face goes up; else the server's face replaces the phone's.
    func reconcile(with user: APIUser?) async {
        guard let user, session.isSignedIn else { return }
        await lastSend?.value
        if isUnsent {
            _ = await send()
        } else if let remote = user.avatar, AvatarCatalogue.isValid(remote), remote != parts {
            parts = remote
            store(remote)
        }
    }

    /// Waits for a send that is on its way (without sending anything new).
    func settle() async {
        await lastSend?.value
    }

    /// Sends an unsent face now and waits for it (before signing out, and for tests).
    func flush() async {
        await lastSend?.value
        if isUnsent, session.isSignedIn { _ = await send() }
    }

    /// After the account is deleted or signed out of.
    func clear() {
        parts = .standard
        defaults.removeObject(forKey: Self.defaultsKey)
        defaults.removeObject(forKey: Self.unsentKey)
    }

    private func store(_ face: AvatarParts) {
        if let data = try? JSONEncoder().encode(face) { defaults.set(data, forKey: Self.defaultsKey) }
    }

    private func queueSend() {
        guard session.isSignedIn else { return }
        let previous = lastSend
        lastSend = Task { [self] in
            await previous?.value
            _ = await send()
        }
    }

    /// Sends the current face; the unsent mark goes away only when the server took it and it is still the current face.
    private func send() async -> Bool {
        let face = parts
        let session = session
        let api = session.api
        guard let user = try? await session.authorized({ try await api.setAvatar(face, token: $0) }) else { return false }
        session.update(user: user)
        if face == parts { defaults.removeObject(forKey: Self.unsentKey) }
        return true
    }
}
