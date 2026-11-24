import Foundation
import Observation

/// The points and the streak shown on the بازی tab and on Profile: for a signed-in person the server's (`/v1/me/stats`)
/// once it has answered, but never less than the phone's own (points from before the account, rounds not sent yet) when
/// those are this account's: points carried over to another account are not counted for this one. Also how many friends solved today's puzzle.
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

    /// The phone's points are the signed-in account's own (or nobody's yet).
    private var localIsMine: Bool { local.owner == nil || local.owner == session.user?.id }

    var points: Int { session.isSignedIn ? max(remote?.totalPoints ?? 0, localIsMine ? local.guestPoints : 0) : local.points }
    var streak: Int { session.isSignedIn ? max(remote?.streakDays ?? 0, localIsMine ? local.streak : 0) : local.streak }

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
