import Foundation

/// How a letter of a try fits the word: green is in its place, yellow is in the word elsewhere, grey is not in it
/// (or there are no more of it).
enum LetterMark: String, Codable, Sendable {
    case green, yellow, grey

    fileprivate var rank: Int {
        switch self {
        case .grey: 0
        case .yellow: 1
        case .green: 2
        }
    }
}

enum LetterFeedback {
    /// The marks of a try, as in Wordle: greens first, then each yellow takes one of the word's remaining
    /// letters, so a letter typed twice is yellow twice only if the word has it twice.
    static func marks(guess: [Character], answer: [Character]) -> [LetterMark] {
        var marks = [LetterMark](repeating: .grey, count: guess.count)
        var left: [Character: Int] = [:]
        for (index, letter) in answer.enumerated() where index >= guess.count || guess[index] != letter {
            left[letter, default: 0] += 1
        }
        for index in guess.indices where index < answer.count && guess[index] == answer[index] {
            marks[index] = .green
        }
        for index in guess.indices where marks[index] != .green {
            if let count = left[guess[index]], count > 0 {
                marks[index] = .yellow
                left[guess[index]] = count - 1
            }
        }
        return marks
    }
}

/// What the phone keeps of one day's puzzle.
struct DailyRecord: Codable, Equatable, Sendable {
    enum Outcome: String, Codable, Sendable { case playing, solved, failed }

    var tries: [String] = []
    /// The positions the bulb gave away.
    var hinted: [Int] = []
    var outcome = Outcome.playing
    /// What the puzzle earned: set when it is solved.
    var points = 0
}

/// One play of معمای امروز: three tries at the word, typed from the keyboard, with a bulb that gives one letter.
struct DailyGame: Equatable, Sendable {
    static let maxTries = 3

    let answer: [Character]
    private(set) var tries: [[Character]]
    /// The positions the bulb gave away, in the order they were given.
    private(set) var hinted: [Int]
    /// The row being typed: a letter or nil in each position. Given positions are filled and stay.
    private(set) var entry: [Character?]

    init(answer: [Character], record: DailyRecord = DailyRecord()) {
        self.answer = answer
        tries = record.tries.map { Array($0) }
        hinted = record.hinted
        entry = [Character?](repeating: nil, count: answer.count)
        fillHints()
    }

    var outcome: DailyRecord.Outcome {
        if let last = tries.last, last == answer { return .solved }
        return tries.count >= Self.maxTries ? .failed : .playing
    }

    /// Which try (1-based) found the word.
    var solvedOnTry: Int? { outcome == .solved ? tries.count : nil }

    var record: DailyRecord {
        DailyRecord(tries: tries.map { String($0) }, hinted: hinted, outcome: outcome, points: points)
    }

    /// What the puzzle earns: nothing until it is solved.
    var points: Int {
        solvedOnTry.map { Scoring.daily(solvedOnTry: $0, hints: hinted.count) } ?? 0
    }

    var marks: [[LetterMark]] {
        tries.map { LetterFeedback.marks(guess: $0, answer: answer) }
    }

    /// The best mark of each letter typed so far, for colouring the keys.
    var keyMarks: [Character: LetterMark] {
        var result: [Character: LetterMark] = [:]
        for (letters, marks) in zip(tries, self.marks) {
            for (letter, mark) in zip(letters, marks) where (result[letter]?.rank ?? -1) < mark.rank {
                result[letter] = mark
            }
        }
        return result
    }

    /// The position the next typed letter goes to.
    var cursor: Int? {
        entry.indices.first { entry[$0] == nil }
    }

    var canSubmit: Bool { outcome == .playing && cursor == nil }

    /// The bulb has a letter to give: one the word has in a position not given and not already found in place.
    var canHint: Bool { outcome == .playing && hintPosition != nil }

    mutating func type(_ letter: Character) {
        guard outcome == .playing, let cursor else { return }
        entry[cursor] = letter
    }

    /// Takes back the last typed letter (not the ones the bulb gave).
    mutating func erase() {
        guard outcome == .playing, let last = entry.indices.last(where: { entry[$0] != nil && !hinted.contains($0) }) else { return }
        entry[last] = nil
    }

    /// Puts the typed row in as a try. False when the row is not full.
    @discardableResult
    mutating func submit() -> Bool {
        guard canSubmit else { return false }
        tries.append(entry.compactMap { $0 })
        entry = [Character?](repeating: nil, count: answer.count)
        fillHints()
        return true
    }

    /// Gives one letter: the first position that is neither given nor already green in a try.
    @discardableResult
    mutating func hint() -> Bool {
        guard outcome == .playing, let position = hintPosition else { return false }
        hinted.append(position)
        entry[position] = answer[position]
        return true
    }

    private var hintPosition: Int? {
        let found = Set(zip(tries, marks).flatMap { letters, marks in marks.indices.filter { marks[$0] == .green && $0 < letters.count } })
        return answer.indices.first { !hinted.contains($0) && !found.contains($0) }
    }

    private mutating func fillHints() {
        for position in hinted where entry.indices.contains(position) { entry[position] = answer[position] }
    }
}
