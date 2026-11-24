import Foundation

/// A couplet that can be played in مشاعره: from the divan or from a bundled book.
struct MoshCandidate: Equatable, Identifiable, Sendable {
    let key: String
    let couplet: Couplet
    let poetSlug: String
    /// «غزل ۳»
    let title: String
    let inDivan: Bool
    /// Both hemistichs, normalised.
    let text: String
    /// The recitations of its poem: the popular ones come first among the books' couplets.
    let popularity: Int

    var id: String { key }

    init(_ entry: DivanEntry) {
        key = entry.key
        couplet = entry.couplet
        poetSlug = entry.poetSlug
        title = entry.title
        inDivan = true
        text = TextNormalizer.normalize("\(entry.couplet.m1) \(entry.couplet.m2)")
        popularity = 0
    }

    init(_ entry: CoupletEntry) {
        key = entry.id
        couplet = entry.couplet
        poetSlug = entry.poet
        title = entry.title
        inDivan = false
        text = entry.text
        popularity = entry.popularity
    }

    fileprivate var startsWith: Character? { MoshLetters.first(of: couplet.m1) }
}

/// The couplets offered for the next move and the matching of typed text, locally: the server checks the same things
/// against Ganjoor's text, but a couplet that can't be found here is never sent.
enum MoshSuggestions {
    /// What typed text was found to be.
    enum Match: Equatable {
        case found(MoshCandidate)
        /// No couplet of the divan or the books starts with these words.
        case notFound
        /// A couplet was found, but it doesn't start with the letter to answer.
        case wrongLetter
        /// It was found, and it was played already.
        case alreadyPlayed
    }

    /// The couplets to pick from: those whose first hemistich starts with `letter` (any, for the first couplet of the
    /// game) and, once something is typed, with those words; not played yet. The divan first (the newest first), then the
    /// books' by how often they are recited.
    static func suggestions(letter: Character?, typed: String, divan: [DivanEntry], books: [CoupletEntry], used: Set<String>, limit: Int) -> [MoshCandidate] {
        let prefix = TextNormalizer.normalize(typed)
        func fits(_ candidate: MoshCandidate) -> Bool {
            !used.contains(candidate.key) && (letter == nil || candidate.startsWith == letter) && candidate.text.hasPrefix(prefix)
        }
        var result: [MoshCandidate] = []
        for entry in divan {
            let candidate = MoshCandidate(entry)
            if fits(candidate) { result.append(candidate) }
            if result.count == limit { return result }
        }
        // A letter's couplets are many: the cheap tests (letter, key) come before the building of each candidate.
        let inDivan = Set(divan.map(\.key))
        let found = books.enumerated().filter { _, entry in
            !used.contains(entry.id) && !inDivan.contains(entry.id) && (letter == nil || MoshLetters.first(of: entry.couplet.m1) == letter) && entry.text.hasPrefix(prefix)
        }
        let ranked = found.sorted { ($0.element.popularity, $1.offset) > ($1.element.popularity, $0.offset) }
        for (_, entry) in ranked.prefix(limit - result.count) { result.append(MoshCandidate(entry)) }
        return result
    }

    /// Typed text as a couplet. The text must give the whole first hemistich (and may go on into the second); spelling
    /// is compared as the server does (diacritics, punctuation and Arabic letter forms don't count).
    static func match(_ typed: String, letter: Character?, divan: [DivanEntry], books: [CoupletEntry], used: Set<String>) -> Match {
        let wanted = TextNormalizer.normalize(typed)
        guard !wanted.isEmpty else { return .notFound }
        let all = divan.map(MoshCandidate.init) + books.sorted { $0.popularity > $1.popularity }.map(MoshCandidate.init)
        var played = false, wrong = false
        for candidate in all where candidate.text.hasPrefix(wanted) && wanted.count >= TextNormalizer.normalize(candidate.couplet.m1).count {
            if used.contains(candidate.key) {
                played = true
            } else if letter != nil, candidate.startsWith != letter {
                wrong = true
            } else {
                return .found(candidate)
            }
        }
        return played ? .alreadyPlayed : wrong ? .wrongLetter : .notFound
    }
}
