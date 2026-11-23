import Foundation
import Observation

/// The face: kept on the phone (every guest has one) and, for a signed-in person, on the server. «ذخیره» saves
/// both. When someone signs in, the server's face comes down if this phone never changed its own; a face made
/// here goes up if the server has none (or another one).
@MainActor @Observable
final class AvatarStore {
    static let defaultsKey = "me.avatar"

    private(set) var parts: AvatarParts
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults

    init(session: Session, defaults: UserDefaults = .standard) {
        self.session = session
        self.defaults = defaults
        let saved = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode(AvatarParts.self, from: $0) }
        parts = saved.flatMap { AvatarCatalogue.isValid($0) ? $0 : nil } ?? .standard
    }

    /// Saves the face here and, with an account, sends it. A failed send is not shown: the face is saved, and
    /// `reconcile` sends it again the next time the app signs in.
    func save(_ new: AvatarParts) async {
        parts = new
        if let data = try? JSONEncoder().encode(new) { defaults.set(data, forKey: Self.defaultsKey) }
        await send(new)
    }

    /// With the user the server knows: its face replaces the phone's standard one; a different face made here goes up.
    func reconcile(with user: APIUser?) async {
        guard let user, session.isSignedIn else { return }
        if let remote = user.avatar, AvatarCatalogue.isValid(remote) {
            if parts == .standard { adopt(remote) } else if remote != parts { await send(parts) }
        } else if parts != .standard {
            await send(parts)
        }
    }

    /// After the account is deleted.
    func clear() {
        parts = .standard
        defaults.removeObject(forKey: Self.defaultsKey)
    }

    private func adopt(_ remote: AvatarParts) {
        parts = remote
        if let data = try? JSONEncoder().encode(remote) { defaults.set(data, forKey: Self.defaultsKey) }
    }

    private func send(_ face: AvatarParts) async {
        guard session.isSignedIn else { return }
        let session = session
        let api = session.api
        if let user = try? await session.authorized({ try await api.setAvatar(face, token: $0) }) { session.update(user: user) }
    }
}
