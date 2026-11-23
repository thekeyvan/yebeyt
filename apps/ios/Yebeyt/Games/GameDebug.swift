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
    /// The quiz games: this many answered (every third one wrong), then an option chosen; with `sheet` the last answer's
    /// sheet stays open. `stubbed`: گوش کن plays canned recitations (no network).
    case quiz(answered: Int, sheet: Bool, stubbed: Bool)
    /// معنی‌یاب: this many pairs, then a word in hand.
    case match(pairs: Int)

    var stubsRecitations: Bool {
        if case .quiz(_, _, true) = self { true } else { false }
    }
}

extension QuizSession {
    func autoplay(_ plan: GameAutoplay) {
        guard case .quiz(let answered, let sheet, _) = plan, answered > 0 else { return }
        for number in 1...answered {
            for _ in 0..<5 { tick() }
            let correct = round.current.correct
            select(number % 3 == 0 ? (correct + 1) % round.current.options.count : correct)
            confirm()
            if number < answered || !sheet { next() }
        }
        if !sheet, !round.isOver { select(round.current.options.count > 2 ? 2 : 1) }
    }
}

extension MatchSession {
    func autoplay(_ plan: GameAutoplay) {
        guard case .match(let pairs) = plan, pairs > 0 else { return }
        for id in 0..<min(pairs, round.current.words.count) {
            selectWord(id)
            pick(meaning: id)
        }
        if let next = round.current.words.first(where: { !round.matched.contains($0.id) }) { selectWord(next.id) }
    }
}

extension ListenLoader {
    /// Canned answers for simulator runs: every poem has a recitation whose timing gives each hemistich four seconds.
    @MainActor static func stub(store: PoetryStore) -> ListenLoader {
        let recitation = #"[{"id":1,"audioArtist":"-","mp3Url":"https://example.invalid/a.mp3","xmlUrl":"https://example.invalid/a.xml","inSyncWithText":true,"audioOrder":1}]"#
        let verses = (0..<100).map { "<SyncInfo><VerseOrder>\($0)</VerseOrder><AudioMiliseconds>\($0 * 4000)</AudioMiliseconds></SyncInfo>" }.joined()
        let timing = "<A><PoemAudio><SyncArray>\(verses)</SyncArray></PoemAudio></A>"
        return ListenLoader(
            poem: { try await store.poem(path: $0) },
            recitations: { _ in try JSONDecoder().decode([Recitation].self, from: Data(recitation.utf8)) },
            timing: { _ in Data(timing.utf8) }
        )
    }
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
        case .none, .tries, .quiz, .match:
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
