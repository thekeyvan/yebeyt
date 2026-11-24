import Foundation
import Observation

/// The points and the streak shown on the بازی tab and on Profile: the server's (`/v1/me/stats`) for a signed-in
/// person once it has answered, else the phone's own.
@MainActor @Observable
final class MyStats {
    private(set) var remote: RemoteStats?
    @ObservationIgnored private let local: GameStats
    @ObservationIgnored private let session: Session

    init(local: GameStats, session: Session) {
        self.local = local
        self.session = session
    }

    var points: Int { session.isSignedIn ? remote?.totalPoints ?? local.points : local.points }
    var streak: Int { session.isSignedIn ? remote?.streakDays ?? local.streak : local.streak }

    /// Asks the server again; a failure keeps what is shown.
    func refresh() async {
        guard session.isSignedIn else {
            remote = nil
            return
        }
        let api = session.api
        if let stats = try? await session.authorized({ try await api.stats(token: $0) }) { remote = stats }
    }
}
