import Foundation
import Observation

/// A round being played: the round itself, and what it does to the phone's points. Points are added as
/// couplets are answered; the seconds left are added when the last couplet is.
@MainActor @Observable
final class JigsawSession {
    private(set) var round: JigsawRound
    /// The sheet with the full couplet is on screen.
    var sheetShown: Bool { round.sheetOpen }
    private(set) var finished = false
    /// The app is not in front (another app, the lock screen, a share sheet): the clock waits.
    var isPaused = false
    private let stats: GameStats
    @ObservationIgnored private var generator: SeededGenerator

    init(round: JigsawRound, stats: GameStats, seed: UInt64 = .random(in: .min ... .max)) {
        self.round = round
        self.stats = stats
        generator = SeededGenerator(seed: seed)
    }

    var timeText: String {
        let left = round.timeLeft
        return "\(PersianDigits.string(left / 60)):\(PersianDigits.string(left % 60 / 10))\(PersianDigits.string(left % 10))"
    }

    func tick() {
        guard !isPaused else { return }
        let wasOver = round.isOver
        round.tick()
        if !wasOver, round.isOver { finish() }
    }

    func edit(_ change: (inout JigsawBoard) -> Void) {
        round.edit(change)
    }

    func shuffle() {
        round.edit { $0.shuffle(using: &generator) }
    }

    /// «بچسبون!»
    func check() {
        guard let answer = round.check() else { return }
        stats.award(answer.result.points)
    }

    /// «بیت بعدی»; after the last couplet the round ends.
    func next() {
        if round.isFinished { finish() } else { round.next() }
    }

    /// Ends the round once: the seconds left and the best score are kept.
    private func finish() {
        guard !finished else { return }
        finished = true
        stats.award(round.timeBonus)
        stats.raiseBest(.jigsaw, to: round.totalPoints)
    }
}
