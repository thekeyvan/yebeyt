import Foundation
import Observation

/// What has been read on this phone: the poem opened last (with its couplet) and the poems finished.
/// A poem is read («خوندی») once the reader reached its last couplet, in couplet mode, or the end of the
/// whole poem. «داری می‌خونی» is the poem opened last, when it is not finished. Kept as JSON in UserDefaults.
@MainActor @Observable
final class ReadingProgress {
    struct Last: Codable, Equatable, Sendable {
        var path: String
        /// The 0-based couplet it was left at.
        var couplet: Int
        /// «غزل ۳», for the «ادامه» cards.
        var title: String
    }

    private struct Saved: Codable {
        var last: Last?
        var finished: Set<String>
    }

    static let defaultsKey = "reader.progress"

    private(set) var last: Last?
    private(set) var finished: Set<String>
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let saved = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode(Saved.self, from: $0) }
        last = saved?.last
        finished = saved?.finished ?? []
    }

    /// The reader is on this couplet of a poem with `count` couplets; its last couplet finishes the poem.
    func opened(path: String, couplet: Int, count: Int, title: String) {
        last = Last(path: path, couplet: couplet, title: title)
        if couplet >= count - 1 { finished.insert(path) }
        save()
    }

    /// The whole-poem list was scrolled to its end.
    func reachedEnd(path: String) {
        finished.insert(path)
        save()
    }

    func isRead(_ path: String) -> Bool { finished.contains(path) }

    /// The poem opened last, when it is not finished.
    func isInProgress(_ path: String) -> Bool { last?.path == path && !isRead(path) }

    /// How many of these poems are read.
    func readCount<Paths: Sequence<String>>(in paths: Paths) -> Int {
        paths.reduce(0) { $0 + (finished.contains($1) ? 1 : 0) }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(Saved(last: last, finished: finished)) {
            defaults.set(data, forKey: Self.defaultsKey)
        }
    }
}
