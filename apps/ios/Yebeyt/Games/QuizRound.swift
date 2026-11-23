import Foundation

/// A round of حدس شاعر, مصراع دوم, از کدوم کتاب؟ or گوش کن: questions one after another, each with options, a choice to
/// confirm, ۵۰:۵۰ (and «یه کلمه» in گوش کن) and a clock that depends on the game. The clock runs only while a question is
/// being played, not while the sheet after the answer is open.
struct QuizRound: Equatable, Sendable {
    enum Clock: Equatable, Sendable {
        /// Seconds for each question; when they pass the question is a wrong answer.
        case perQuestion(Int)
        /// Seconds for the whole round; when they pass the round is over.
        case round(Int)
        case none
    }

    struct Answer: Equatable, Sendable {
        /// The option confirmed; nil when the time ran out.
        var chosen: Int?
        var right: Bool
        var points: Int
        var seconds: Int
    }

    let kind: GameKind
    let questions: [QuizQuestion]
    let clock: Clock
    private(set) var index = 0
    private(set) var selected: Int?
    /// The options ۵۰:۵۰ took away from the question in play.
    private(set) var removed: Set<Int> = []
    private(set) var wordShown = false
    private(set) var replaysLeft = 1
    /// One for each question passed: its answer, or nil when it was skipped.
    private var slots: [Answer?] = []
    private(set) var roundLeft: Int
    private(set) var secondsOnCurrent = 0

    /// The answers given (skipped questions have none).
    var answers: [Answer] { slots.compactMap { $0 } }

    init?(kind: GameKind, questions: [QuizQuestion]) {
        guard !questions.isEmpty else { return nil }
        self.kind = kind
        self.questions = questions
        switch kind {
        case .poet, .book: clock = .perQuestion(Scoring.quizWindow)
        case .misra: clock = .round(120)
        default: clock = .none
        }
        if case .round(let seconds) = clock { roundLeft = seconds } else { roundLeft = 0 }
    }

    var current: QuizQuestion { questions[index] }

    /// The answer whose sheet is open: the question is answered but the player has not moved on.
    var sheetOpen: Bool { slots.count > index && slots[index] != nil }

    var lastAnswer: Answer? { sheetOpen ? slots[index] : nil }

    var isFinished: Bool { slots.count == questions.count }

    /// Every question is answered, or the round's time is up.
    var isOver: Bool { isFinished || (isRoundClock && roundLeft == 0) }

    private var isRoundClock: Bool {
        if case .round = clock { return true }
        return false
    }

    /// The seconds the clock shows; nil in games without one.
    var timeLeft: Int? {
        switch clock {
        case .perQuestion(let limit): max(0, limit - secondsOnCurrent)
        case .round: roundLeft
        case .none: nil
        }
    }

    var points: Int { answers.reduce(0) { $0 + $1.points } }

    var rightCount: Int { answers.filter(\.right).count }

    /// One dot each: right, wrong, or nil for a question that was skipped.
    var results: [Bool?] { slots.map { $0?.right } }

    /// The hints used on the question in play, each costing 20.
    var hints: Int { (removed.isEmpty ? 0 : 1) + (wordShown ? 1 : 0) }

    private var inPlay: Bool { !isOver && !sheetOpen }

    /// ۵۰:۵۰ is on حدس شاعر and مصراع دوم.
    var canFifty: Bool { (kind == .poet || kind == .misra) && removed.isEmpty && inPlay }

    var canShowWord: Bool { kind == .listen && !wordShown && inPlay }

    /// «رد کن» is on حدس شاعر, مصراع دوم and گوش کن.
    var canSkip: Bool { kind != .book && inPlay }

    mutating func tick() {
        guard inPlay else { return }
        switch clock {
        case .none:
            return
        case .round:
            roundLeft -= 1
            secondsOnCurrent += 1
        case .perQuestion(let limit):
            secondsOnCurrent += 1
            if secondsOnCurrent >= limit { slots.append(Answer(chosen: nil, right: false, points: 0, seconds: limit)) }
        }
    }

    /// Chooses an option; choosing the chosen one again lets it go.
    mutating func select(_ option: Int) {
        guard inPlay, current.options.indices.contains(option), !removed.contains(option) else { return }
        selected = selected == option ? nil : option
    }

    /// «همینه!»: nothing happens until an option is chosen.
    @discardableResult
    mutating func confirm() -> Answer? {
        guard inPlay, let selected else { return nil }
        let right = selected == current.correct
        let points = right ? Scoring.quiz(secondsLeft: secondsLeftForBonus, hints: hints) : 0
        let answer = Answer(chosen: selected, right: right, points: points, seconds: clock == .none ? 0 : secondsOnCurrent)
        slots.append(answer)
        return answer
    }

    /// «رد کن»: no points, no answer and no sheet; the next question starts, or the round ends after the last one.
    mutating func skip() {
        guard canSkip else { return }
        slots.append(nil)
        startNext()
    }

    private var secondsLeftForBonus: Int {
        clock == .none ? 0 : max(0, Scoring.quizWindow - secondsOnCurrent)
    }

    /// ۵۰:۵۰: half of the wrong options go away (two of four, one of three).
    mutating func fifty(using generator: inout SeededGenerator) {
        guard canFifty else { return }
        let wrong = current.options.indices.filter { $0 != current.correct }
        removed = Set(generator.shuffled(wrong).prefix(current.options.count / 2))
        if let chosen = selected, removed.contains(chosen) { selected = nil }
    }

    /// «یه کلمه» of گوش کن.
    mutating func showWord() {
        if canShowWord { wordShown = true }
    }

    /// «دوباره بشنو»: whether there was a replay left to use.
    mutating func useReplay() -> Bool {
        guard kind == .listen, inPlay, replaysLeft > 0 else { return false }
        replaysLeft -= 1
        return true
    }

    /// «سؤال بعدی»: the next question. After the last one the round is finished.
    mutating func next() {
        guard sheetOpen, !isFinished else { return }
        startNext()
    }

    private mutating func startNext() {
        guard !isFinished else { return }
        index += 1
        selected = nil
        removed = []
        wordShown = false
        replaysLeft = 1
        secondsOnCurrent = 0
    }
}
