import Foundation

/// «بیتِ امروز»: one couplet a day, the same all day, from the popular couplets of the bundled books.
enum DailyPick {
    struct Candidate: Hashable, Sendable {
        var path: String
        var couplet: Int
    }

    /// The poems taken as popular: the most recited ones.
    static let poemLimit = 100
    /// Primes above any candidate count (the list is cut below the smaller one): stepping by one of them
    /// visits every candidate before repeating. A new day steps by `dayStep`, a reject by `rejectStep`, so
    /// rejecting today's couplet does not show tomorrow's.
    private static let rejectStep = 7919
    private static let dayStep = 7907

    /// The poems of the poets the person picked in onboarding (the first part of a poem's path is its poet), when
    /// there are any among `poems`; otherwise all of them.
    static func preferring(_ poets: Set<String>, in poems: [IndexedPoem]) -> [IndexedPoem] {
        guard !poets.isEmpty else { return poems }
        let liked = poems.filter { poem in poem.path.split(separator: "/").first.map { poets.contains(String($0)) } == true }
        return liked.isEmpty ? poems : liked
    }

    /// Every couplet of the most recited poems, most recited first (ties by path, so the order is stable).
    static func candidates(from poems: [IndexedPoem]) -> [Candidate] {
        let popular = poems.filter { $0.recitations > 0 }
            .sorted { ($0.recitations, $1.path) > ($1.recitations, $0.path) }
            .prefix(poemLimit)
        return popular.flatMap { poem in (0..<poem.couplets).map { Candidate(path: poem.path, couplet: $0) } }
            .prefix(dayStep - 1).map { $0 }
    }

    /// The candidate of a day after `rejected` «رد کن»s: each reject shows another candidate, and none
    /// repeats before every candidate has been shown.
    static func pick(day: Int, rejected: Int, from candidates: [Candidate]) -> Candidate? {
        guard !candidates.isEmpty else { return nil }
        let count = candidates.count
        let start = (day % count + count) % count * (dayStep % count) % count
        return candidates[(start + rejected * (rejectStep % count)) % count]
    }

    /// The day as a number that changes at local midnight.
    static func dayNumber(for date: Date, calendar: Calendar = .current) -> Int {
        let start = calendar.startOfDay(for: Date(timeIntervalSince1970: 0))
        return calendar.dateComponents([.day], from: start, to: calendar.startOfDay(for: date)).day ?? 0
    }
}
