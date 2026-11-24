import Foundation
import Observation

/// رده‌بندی: the three boards, each fetched when its tab is first opened.
@MainActor @Observable
final class LeaderboardModel {
    enum Tab: CaseIterable, Sendable {
        case league, friends, global

        var title: String {
            switch self {
            case .league: "لیگ این هفته"
            case .friends: "دوستا"
            case .global: "همه"
            }
        }
    }

    enum Phase: Equatable {
        case loading, loaded
        case failed(String)
    }

    var tab: Tab
    private(set) var league: LeagueStandings?
    private(set) var friends: FriendsStandings?
    private(set) var global: GlobalStandings?
    private(set) var phases: [Tab: Phase] = [:]
    @ObservationIgnored private let session: Session
    @ObservationIgnored private var globalCursor: String?
    @ObservationIgnored private var isLoadingMore = false

    init(session: Session, tab: Tab = .league) {
        self.session = session
        self.tab = tab
    }

    func phase(of tab: Tab) -> Phase { phases[tab] ?? .loading }

    var hasMoreGlobal: Bool { globalCursor != nil }

    /// Loads the tab on screen, once; `force` loads it again (pull to refresh, coming back).
    func load(force: Bool = false) async {
        let tab = tab
        if !force, phases[tab] == .loaded { return }
        let api = session.api
        do {
            switch tab {
            case .league: league = try await session.authorized { try await api.leagueStandings(token: $0) }
            case .friends: friends = try await session.authorized { try await api.friendsStandings(token: $0) }
            case .global:
                let page = try await session.authorized { try await api.globalStandings(cursor: nil, token: $0) }
                global = page
                globalCursor = page.nextCursor
            }
            phases[tab] = .loaded
        } catch {
            if phases[tab] != .loaded { phases[tab] = .failed(FeedbackLog.shared.shown(error as? APIError ?? .badResponse)) }
        }
    }

    /// The next 50 of the global list.
    func loadMoreGlobal() async {
        guard let cursor = globalCursor, !isLoadingMore, var current = global else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        let api = session.api
        guard let page = try? await session.authorized({ try await api.globalStandings(cursor: cursor, token: $0) }) else { return }
        current.rows += page.rows.filter { new in !current.rows.contains { $0.rank == new.rank } }
        current.nextCursor = page.nextCursor
        global = current
        globalCursor = page.nextCursor
    }
}
