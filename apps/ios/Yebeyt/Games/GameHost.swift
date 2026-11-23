import SwiftUI

/// The game in front of the tabs, as a full screen of its own (no tab bar). It is a layer of the root view, not a
/// modal, so the reader can open over it («کل شعر») and a couplet can leave the reader for a game in one step.
struct GameHost: View {
    let route: GameRoute
    @Environment(GameDeck.self) private var deck
    @Environment(GameStats.self) private var stats

    var body: some View {
        Group {
            switch route {
            case .daily:
                if let puzzle = DailyPuzzle.pick(day: stats.today, from: deck) {
                    DailyScreen(puzzle: puzzle, day: stats.today, stats: stats)
                }
            case .jigsaw(let start):
                JigsawScreen(start: start)
            case .quiz(let start):
                QuizScreen(start: start)
            case .match:
                MatchScreen()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background { DottedPaper().ignoresSafeArea() }
    }
}
