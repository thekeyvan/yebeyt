import Foundation
import Observation

/// معمای امروز being played: the puzzle of the day, the game, and what it does to the phone's stats.
/// Every try and hint is kept at once, so leaving and coming back finds the same state.
@MainActor @Observable
final class DailySession {
    let puzzle: DailyPuzzle
    let day: TehranDay
    private(set) var game: DailyGame
    private let stats: GameStats

    init(puzzle: DailyPuzzle, day: TehranDay, stats: GameStats) {
        self.puzzle = puzzle
        self.day = day
        self.stats = stats
        game = DailyGame(answer: puzzle.letters, record: stats.daily(on: day) ?? DailyRecord())
    }

    var isOver: Bool { game.outcome != .playing }

    func type(_ letter: Character) { game.type(letter) }

    func erase() { game.erase() }

    func submit() {
        if game.submit() { stats.record(game.record, on: day) }
    }

    func hint() {
        if game.hint() { stats.record(game.record, on: day) }
    }
}
