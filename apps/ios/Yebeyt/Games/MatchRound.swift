import Foundation

/// A written word of a couplet; `glossed` words are the dotted ones.
struct MatchToken: Equatable, Sendable {
    let text: String
    let glossed: Bool
}

/// A hard word and its meaning. Its id is its place among the words, in reading order.
struct MatchWord: Equatable, Sendable, Identifiable {
    let id: Int
    let text: String
    let gloss: String
}

/// One couplet of معنی‌یاب: its words and the meanings in another order.
struct MatchQuestion: Equatable, Sendable {
    static let maxWords = 5

    let couplet: GameCouplet
    /// The two hemistichs, word by word.
    let lines: [[MatchToken]]
    /// The glossed words as they are read (the first hemistich first).
    let words: [MatchWord]
    /// The word ids in the order of the meanings column.
    let meanings: [Int]

    /// Words that are not found in the couplet are left out; with fewer than two there is no question.
    init?(entry: GlossaryEntry, couplet: GameCouplet, generator: inout SeededGenerator) {
        var found: [(hemistich: Int, start: Int, range: Range<Int>, word: GlossaryWord)] = []
        var lines: [[MatchToken]] = []
        for hemistich in [1, 2] {
            let words = entry.words.filter { $0.m == hemistich }
            let located = GlossMatch.locate(words.map(\.text), in: hemistich == 1 ? couplet.m1 : couplet.m2)
            var glossed = Set<Int>()
            for (word, range) in zip(words, located.ranges) {
                guard let range else { continue }
                found.append((hemistich, range.lowerBound, range, word))
                glossed.formUnion(range)
            }
            lines.append(located.tokens.enumerated().map { MatchToken(text: $1, glossed: glossed.contains($0)) })
        }
        let ordered = found.sorted { ($0.hemistich, $0.start) < ($1.hemistich, $1.start) }.prefix(Self.maxWords)
        guard ordered.count >= 2 else { return nil }
        self.couplet = couplet
        self.lines = lines
        words = ordered.enumerated().map { MatchWord(id: $0.offset, text: $0.element.word.text, gloss: $0.element.word.gloss) }
        var meanings = generator.shuffled(Array(words.indices))
        if meanings == Array(words.indices) { meanings = Array(meanings.reversed()) }  // never in the order of the words
        self.meanings = meanings
    }
}

/// A round of معنی‌یاب: five couplets, each with its hard words to match to their meanings. A wrong meaning only
/// shakes; there is no clock and no penalty.
struct MatchRound: Equatable, Sendable {
    enum Pick: Equatable, Sendable { case matched, wrong, ignored }

    static let questionCount = 5

    let questions: [MatchQuestion]
    private(set) var index = 0
    /// The words of the couplet in play that have their meaning.
    private(set) var matched: Set<Int> = []
    private(set) var selectedWord: Int?
    private(set) var pairs = 0

    init?(questions: [MatchQuestion]) {
        guard !questions.isEmpty else { return nil }
        self.questions = questions
    }

    /// Five couplets from the entries, in a random order; the ones `couplet` can't give are skipped.
    static func make(entries: [GlossaryEntry], couplet: (GlossaryEntry) -> GameCouplet?, generator: inout SeededGenerator) -> MatchRound? {
        var questions: [MatchQuestion] = []
        for entry in generator.shuffled(entries) where questions.count < questionCount {
            guard let game = couplet(entry), let question = MatchQuestion(entry: entry, couplet: game, generator: &generator) else { continue }
            questions.append(question)
        }
        return MatchRound(questions: questions)
    }

    var current: MatchQuestion { questions[index] }

    var points: Int { pairs * Scoring.matchPair }

    /// Every word of the couplet has its meaning: the sheet opens.
    var sheetOpen: Bool { matched.count == current.words.count }

    var isFinished: Bool { sheetOpen && index == questions.count - 1 }

    /// One dot each: the couplets that are done.
    var results: [Bool] { Array(repeating: true, count: index + (sheetOpen ? 1 : 0)) }

    /// Taps a word; tapping the one in hand again puts it down.
    mutating func selectWord(_ id: Int) {
        guard !sheetOpen, current.words.contains(where: { $0.id == id }), !matched.contains(id) else { return }
        selectedWord = selectedWord == id ? nil : id
    }

    /// Taps a meaning (named by the id of the word it belongs to) with a word in hand.
    mutating func pick(meaning id: Int) -> Pick {
        guard !sheetOpen, let word = selectedWord, current.words.contains(where: { $0.id == id }), !matched.contains(id) else { return .ignored }
        guard word == id else { return .wrong }
        matched.insert(id)
        selectedWord = nil
        pairs += 1
        return .matched
    }

    /// «سؤال بعدی»
    mutating func next() {
        guard sheetOpen, !isFinished else { return }
        index += 1
        matched = []
        selectedWord = nil
    }
}
