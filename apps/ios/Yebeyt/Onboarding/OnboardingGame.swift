import Foundation
import Observation

/// OnbGame: one couplet of جورچین بیت and 30 seconds. It reuses the game's board and question; the clock and the
/// reward are its own. Winning is worth +۵۰ points (the account step shows it).
@MainActor @Observable
final class OnboardingGame {
    enum Outcome: Equatable { case won, timedOut }

    static let duration = 30
    static let reward = 50
    /// A short second hemistich keeps the couplet at two or three missing words.
    private static let wordRange = 4...6

    private(set) var board: JigsawBoard
    private(set) var timeLeft = OnboardingGame.duration
    private(set) var outcome: Outcome?

    init(question: JigsawQuestion) {
        board = JigsawBoard(question)
    }

    /// A game with a short couplet from the deck, of a poet the person picked when there is one.
    static func make(deck: GameDeck, preferring poets: Set<String>, generator: inout SeededGenerator) -> OnboardingGame? {
        let short = deck.couplets.filter { JigsawQuestion.canPlay($0) && wordRange.contains($0.m2.split(whereSeparator: \.isWhitespace).count) }
        let liked = short.filter { poets.contains($0.poetSlug) }
        guard let couplet = generator.shuffled(liked.isEmpty ? short : liked).first else { return nil }
        let others = generator.shuffled(deck.couplets.filter { $0.id != couplet.id }.prefix(40).flatMap { $0.m2.split(whereSeparator: \.isWhitespace).map(String.init) })
        guard let question = JigsawQuestion(couplet: couplet, distractors: others, generator: &generator) else { return nil }
        return OnboardingGame(question: question)
    }

    var isOver: Bool { outcome != nil }

    /// Words in the right place so far (the given ones count), and those still to come: «سه تا درست، دو تا مونده!».
    var rightCount: Int { board.question.words.indices.filter { board.word(at: $0) == board.question.words[$0] }.count }
    var leftCount: Int { board.question.words.count - rightCount }

    /// «سه تا درست، دو تا مونده!»
    var progressLine: String {
        "\(Self.countWord(rightCount)) تا درست، \(Self.countWord(leftCount)) تا مونده!"
    }

    private static let countWords = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده"]

    private static func countWord(_ count: Int) -> String {
        countWords.indices.contains(count) ? countWords[count] : PersianDigits.string(count)
    }

    func edit(_ change: (inout JigsawBoard) -> Void) {
        guard !isOver else { return }
        change(&board)
    }

    /// One second passes; at zero the game is over.
    func tick() {
        guard !isOver else { return }
        timeLeft -= 1
        if timeLeft <= 0 { outcome = .timedOut }
    }

    /// «بچسبون!»: right ends the game; wrong takes the wrong stickers back to the sheet and lets the person try again.
    func check() {
        guard !isOver, board.isFull else { return }
        if board.check().isRight {
            outcome = .won
            return
        }
        for position in board.question.missing where board.word(at: position) != board.question.words[position] {
            board.remove(at: position)
        }
    }
}
