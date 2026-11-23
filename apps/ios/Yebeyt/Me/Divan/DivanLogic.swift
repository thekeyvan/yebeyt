import Foundation

/// One kept couplet of the divan with what the cards and the groups need: its text, poet and short title.
struct DivanEntry: Identifiable, Equatable, Sendable {
    let key: String
    let path: String
    /// 0-based, as in the reader.
    let index: Int
    let couplet: Couplet
    let poetSlug: String
    /// «غزل ۳»
    let title: String
    let keptAt: Int64

    var id: String { key }
}

/// How the divan is split: by poet, by topic (the first mood the couplet matches) or one list, newest first.
enum DivanGrouping: String, CaseIterable, Sendable {
    case poet, topic, newest

    var title: String {
        switch self {
        case .poet: "شاعر"
        case .topic: "موضوع"
        case .newest: "تازه‌ترین"
        }
    }
}

struct DivanSection: Identifiable, Equatable, Sendable {
    let id: String
    /// Empty for the one list of «تازه‌ترین», which has no header.
    let title: String
    /// Set for a poet's section.
    let poetSlug: String?
    let entries: [DivanEntry]
}

/// Searching, counting and grouping the divan; no screens, no stores.
enum DivanLogic {
    /// The title of the topic group for couplets that match no mood.
    static let restTitle = "بقیه"

    /// The entries matching `query` (a word of the couplet or the poet's name, after normalising; an empty query
    /// keeps all) and `poet` (nil keeps all), newest first.
    static func filter(_ entries: [DivanEntry], query: String, poet: String?, poetName: (String) -> String) -> [DivanEntry] {
        let wanted = TextNormalizer.normalize(query)
        return entries
            .filter { poet == nil || $0.poetSlug == poet }
            .filter { entry in
                wanted.isEmpty || TextNormalizer.normalize("\(entry.couplet.m1) \(entry.couplet.m2) \(poetName(entry.poetSlug))").contains(wanted)
            }
            .sorted(by: newestFirst)
    }

    /// The poets of the divan with their counts, the most first (equal counts by slug).
    static func poetCounts(_ entries: [DivanEntry]) -> [(slug: String, count: Int)] {
        Dictionary(grouping: entries, by: \.poetSlug)
            .map { (slug: $0.key, count: $0.value.count) }
            .sorted { ($0.count, $1.slug) > ($1.count, $0.slug) }
    }

    static func sections(_ entries: [DivanEntry], grouping: DivanGrouping, moods: [Mood], poetName: (String) -> String) -> [DivanSection] {
        guard !entries.isEmpty else { return [] }
        let sorted = entries.sorted(by: newestFirst)
        switch grouping {
        case .newest:
            return [DivanSection(id: "newest", title: "", poetSlug: nil, entries: sorted)]
        case .poet:
            return poetCounts(sorted).map { chip in
                DivanSection(id: chip.slug, title: poetName(chip.slug), poetSlug: chip.slug, entries: sorted.filter { $0.poetSlug == chip.slug })
            }
        case .topic:
            let words = moods.map { mood in (mood, mood.words.map(TextNormalizer.normalize).filter { !$0.isEmpty }) }
            var groups: [String: [DivanEntry]] = [:]
            for entry in sorted {
                let text = TextNormalizer.normalize("\(entry.couplet.m1) \(entry.couplet.m2)")
                let mood = words.first { _, list in list.contains { text.contains($0) } }?.0.key ?? restTitle
                groups[mood, default: []].append(entry)
            }
            let ordered = moods.map { ($0.key, $0.title) } + [(restTitle, restTitle)]
            return ordered.compactMap { key, title in
                groups[key].map { DivanSection(id: key, title: title, poetSlug: nil, entries: $0) }
            }
        }
    }

    private static func newestFirst(_ a: DivanEntry, _ b: DivanEntry) -> Bool {
        (a.keptAt, b.key) > (b.keptAt, a.key)
    }
}

/// «امروز», «دیروز», «هفته‌ی پیش» (up to a week ago), then the date: «۲۴ آبان».
enum DivanDays {
    static func relative(keptAt: Int64, now: Date, calendar: Calendar = .current) -> String {
        let kept = DivanTime.date(keptAt)
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: kept), to: calendar.startOfDay(for: now)).day ?? 0
        switch days {
        case ...0: return "امروز"
        case 1: return "دیروز"
        case 2...7: return "هفته‌ی پیش"
        default: return PersianDate.short(for: kept, timeZone: calendar.timeZone)
        }
    }
}

/// «شاعرِ محبوب»: the poet with the most kept couplets, then the most read poems.
enum FavouritePoet {
    /// `kept` are divan keys («/hafez/g/sh1#0»), `read` poem paths. Nil when there is nothing of either.
    static func slug(kept: [String], read: [String]) -> String? {
        func counts(_ paths: [String]) -> [String: Int] {
            paths.reduce(into: [:]) { result, path in
                if let slug = path.split(separator: "/").first { result[String(slug), default: 0] += 1 }
            }
        }
        let keptCounts = counts(kept), readCounts = counts(read)
        return Set(keptCounts.keys).union(readCounts.keys)
            .max { a, b in
                (keptCounts[a] ?? 0, readCounts[a] ?? 0, b) < (keptCounts[b] ?? 0, readCounts[b] ?? 0, a)
            }
    }
}
