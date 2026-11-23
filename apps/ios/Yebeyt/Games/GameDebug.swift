#if DEBUG
import Foundation

/// What a debug launch plays by itself before the game is shown (`-beytPlay`, and the result and end routes),
/// so a simulator screenshot can show a game in the middle.
enum GameAutoplay: Equatable, Sendable {
    case none
    /// معمای امروز: this many wrong tries.
    case tries(Int)
    /// جورچین: this many right couplets, then a sticker in hand.
    case held(Int)
    /// جورچین: this many right couplets, the last one with its sheet open.
    case sheet(Int)
    /// جورچین: a whole round, eight right and two wrong.
    case end
}

extension DailySession {
    func autoplay(_ plan: GameAutoplay) {
        guard case .tries(let count) = plan else { return }
        for _ in 0..<count where !isOver {
            let stranger = PersianLetters.alphabet.first { !puzzle.letters.contains($0) } ?? "ز"
            for letter in puzzle.letters.dropFirst() + [stranger] { type(letter) }
            submit()
        }
    }
}

extension JigsawSession {
    func autoplay(_ plan: GameAutoplay) {
        switch plan {
        case .held(let count):
            for _ in 0..<count { answer(right: true); next() }
            edit { board in if let sticker = board.onSheet.first { board.select(sticker) } }
        case .sheet(let count):
            for number in 1...count {
                answer(right: true)
                if number < count { next() }
            }
        case .end:
            for number in 1...round.questions.count {
                answer(right: number != 3 && number != 7)
                next()
            }
        case .none, .tries:
            break
        }
    }

    private func answer(right: Bool) {
        for _ in 0..<10 { tick() }
        edit { board in
            for position in board.question.missing {
                let word = board.question.words[position]
                let sticker = right ? board.onSheet.first { $0.word == word } : board.onSheet.first { $0.word != word }
                if let sticker { board.place(sticker, at: position) }
            }
        }
        check()
    }
}
#endif
