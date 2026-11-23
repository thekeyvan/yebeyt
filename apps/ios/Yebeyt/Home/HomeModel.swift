import Foundation
import Observation

/// «بیتِ امروز»: today's couplet and the «رد کن» count of the day (kept, so the same couplet is shown
/// after leaving the app; a new day starts again from its own first couplet).
@MainActor @Observable
final class HomeModel {
    struct Pick: Sendable {
        var path: String
        var index: Int
        var couplet: Couplet
        var poet: String
        /// «غزل ۳»
        var title: String
    }

    static let defaultsKey = "home.rejected"

    private(set) var day: Int
    private(set) var rejected: Int
    private(set) var pick: Pick?
    @ObservationIgnored private var candidates: [DailyPick.Candidate] = []
    @ObservationIgnored private let defaults: UserDefaults

    init(day: Int = DailyPick.dayNumber(for: .now), defaults: UserDefaults = .standard) {
        self.day = day
        self.defaults = defaults
        rejected = Self.savedRejects(for: day, in: defaults)
    }

    private static func savedRejects(for day: Int, in defaults: UserDefaults) -> Int {
        let saved = defaults.array(forKey: defaultsKey) as? [Int]
        return saved?.count == 2 && saved?.first == day ? saved![1] : 0
    }

    func load(poetry: PoetryStore, library: Library) async {
        guard pick == nil else { return }
        candidates = DailyPick.candidates(from: await library.indexedPoems(coveringAny: poetry.bundledPaths))
        await show(poetry: poetry, library: library)
    }

    /// The app came back on `today`: after midnight it is a new day with its own couplet and no rejects.
    func refresh(today: Int, poetry: PoetryStore, library: Library) async {
        guard today != day else { return }
        day = today
        rejected = Self.savedRejects(for: today, in: defaults)
        if candidates.isEmpty { pick = nil; await load(poetry: poetry, library: library) } else { await show(poetry: poetry, library: library) }
    }

    /// «رد کن»: the next candidate for today.
    func reject(poetry: PoetryStore, library: Library) async {
        guard pick != nil else { return }
        rejected += 1
        defaults.set([day, rejected], forKey: Self.defaultsKey)
        await show(poetry: poetry, library: library)
    }

    private func show(poetry: PoetryStore, library: Library) async {
        guard let candidate = DailyPick.pick(day: day, rejected: rejected, from: candidates),
              let poem = try? await poetry.poem(path: candidate.path),
              poem.couplets.indices.contains(candidate.couplet) else { return }
        let slug = candidate.path.split(separator: "/").first.map(String.init) ?? ""
        pick = Pick(
            path: candidate.path, index: candidate.couplet, couplet: poem.couplets[candidate.couplet],
            poet: library.poet(slug: slug)?.name ?? "", title: ReaderText.shortTitle(poem.title)
        )
    }
}
