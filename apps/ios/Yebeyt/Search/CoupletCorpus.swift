import Foundation

/// One couplet of a bundled book, ready for matching.
struct CoupletEntry: Identifiable, Hashable, Sendable {
    var path: String
    var index: Int
    var couplet: Couplet
    /// The poet's slug.
    var poet: String
    /// «غزل ۳»
    var title: String
    /// How many recitations the poem has: the popular ones come first.
    var popularity: Int
    /// Both hemistichs, normalised (`TextNormalizer`).
    var text: String

    var id: String { "\(path)#\(index)" }
}

/// Every couplet of the bundled books, for search and the mood lists.
struct CoupletCorpus: Sendable {
    private(set) var entries: [CoupletEntry]

    /// `popularity` is the recitation count by poem path (poems missing from it count as 0).
    init(poems: [BundledPoem], popularity: [String: Int]) {
        entries = poems.flatMap { item in
            item.poem.couplets.enumerated().map { index, couplet in
                CoupletEntry(
                    path: item.poem.path, index: index, couplet: couplet, poet: item.slug, title: ReaderText.shortTitle(item.poem.title),
                    popularity: popularity[item.poem.path] ?? 0,
                    text: TextNormalizer.normalize("\(couplet.m1) \(couplet.m2)")
                )
            }
        }
    }

    /// Couplets containing the query, the most recited poems first.
    func search(_ query: String, limit: Int) -> [CoupletEntry] {
        let wanted = TextNormalizer.normalize(query)
        guard !wanted.isEmpty else { return [] }
        return top(limit) { $0.text.contains(wanted) }
    }

    /// Couplets containing any of the mood's words, the most recited poems first.
    func matching(_ mood: Mood, limit: Int) -> [CoupletEntry] {
        let words = mood.words.map(TextNormalizer.normalize).filter { !$0.isEmpty }
        return top(limit) { entry in words.contains { entry.text.contains($0) } }
    }

    private func top(_ limit: Int, where matches: (CoupletEntry) -> Bool) -> [CoupletEntry] {
        let found = entries.enumerated().filter { matches($0.element) }
        let ranked = found.sorted { ($0.element.popularity, $1.offset) > ($1.element.popularity, $0.offset) }
        return ranked.prefix(limit).map(\.element)
    }
}
