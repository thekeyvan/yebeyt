import Foundation
import Observation

/// A معنی‌یاب round being played: pairs are added to the phone's points as they are made, the best when the round ends.
@MainActor @Observable
final class MatchSession {
    private(set) var round: MatchRound
    private(set) var finished = false
    private let stats: GameStats

    init(round: MatchRound, stats: GameStats) {
        self.round = round
        self.stats = stats
    }

    func selectWord(_ id: Int) { round.selectWord(id) }

    @discardableResult
    func pick(meaning id: Int) -> MatchRound.Pick {
        let pick = round.pick(meaning: id)
        if pick == .matched { stats.award(Scoring.matchPair) }
        return pick
    }

    /// «سؤال بعدی»; after the last couplet the round ends.
    func next() {
        if round.isFinished { finish() } else { round.next() }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        stats.raiseBest(.match, to: round.points)
        stats.finishRound(of: .match, points: round.points)
    }
}
