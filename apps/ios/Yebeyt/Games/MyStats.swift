import Foundation
import Observation

/// The points and the streak shown on the بازی tab and on Profile: the server's (`/v1/me/stats`) for a signed-in
/// person once it has answered, else the phone's own. Also how many friends solved today's puzzle.
@MainActor @Observable
final class MyStats {
    private(set) var remote: RemoteStats?
    private(set) var friendsSolvedToday = 0
    /// «۱۲ دوست» on Profile; nil until the server has said.
    private(set) var friendsCount: Int?
    @ObservationIgnored private let local: GameStats
    @ObservationIgnored private let session: Session

    init(local: GameStats, session: Session) {
        self.local = local
        self.session = session
    }

    var points: Int { session.isSignedIn ? remote?.totalPoints ?? local.points : local.points }
    var streak: Int { session.isSignedIn ? remote?.streakDays ?? local.streak : local.streak }

    /// «۳ تا از دوستات حلش کردن», only when someone did.
    var friendsLine: String? {
        session.isSignedIn && friendsSolvedToday > 0 ? "\(PersianDigits.string(friendsSolvedToday)) تا از دوستات حلش کردن" : nil
    }

    /// Asks the server how many friends solved the puzzle of `day`; a failure keeps what is shown.
    func refreshFriends(on day: TehranDay) async {
        guard session.isSignedIn else {
            friendsSolvedToday = 0
            return
        }
        let api = session.api
        if let friends = try? await session.authorized({ try await api.dailyFriends(date: day.key, token: $0) }) { friendsSolvedToday = friends.solvedCount }
    }

    /// How many friends I have, from my own public profile.
    func refreshFriendsCount() async {
        guard session.isSignedIn, let username = session.user?.username else {
            friendsCount = nil
            return
        }
        let api = session.api
        if let profile = try? await session.authorized({ try await api.profile(username: username, token: $0) }) { friendsCount = profile.friendsCount }
    }

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
