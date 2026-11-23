import Foundation
import Observation

/// A quiz round being played: the round, and what it does to the phone's points. Points are added as questions
/// are answered; the best of the game is kept when the round ends.
@MainActor @Observable
final class QuizSession {
    private(set) var round: QuizRound
    private(set) var finished = false
    /// The app is not in front (another app, the lock screen, a share sheet): the clock waits.
    var isPaused = false
    private let stats: GameStats
    @ObservationIgnored private var generator: SeededGenerator

    init(round: QuizRound, stats: GameStats, seed: UInt64 = .random(in: .min ... .max)) {
        self.round = round
        self.stats = stats
        generator = SeededGenerator(seed: seed)
    }

    /// «۰:۱۲»; nil in games without a clock.
    var timeText: String? { round.timeLeft.map(PersianDigits.clock) }

    func tick() {
        guard !isPaused else { return }
        let before = round.answers.count
        round.tick()
        if round.answers.count > before { stats.award(round.answers[before].points) }
        if round.isOver, !round.sheetOpen { finish() }
    }

    func select(_ option: Int) { round.select(option) }

    func fifty() { round.fifty(using: &generator) }

    func showWord() { round.showWord() }

    /// «رد کن»
    func skip() {
        round.skip()
        if round.isFinished { finish() }
    }

    func useReplay() -> Bool { round.useReplay() }

    /// «همینه!»
    func confirm() {
        guard let answer = round.confirm() else { return }
        stats.award(answer.points)
    }

    /// «سؤال بعدی»; after the last question the round ends.
    func next() {
        if round.isFinished { finish() } else { round.next() }
    }

    /// Ends the round once: the best score is kept.
    private func finish() {
        guard !finished else { return }
        finished = true
        stats.raiseBest(round.kind, to: round.points)
    }
}
