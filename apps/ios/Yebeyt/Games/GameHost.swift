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
            case .lobby(let start):
                LobbyScreen(start: start)
            case .mosh(let id):
                MoshScreen(gameID: id)
            case .duel(let id):
                DuelScreen(gameID: id)
            case .challenge(let code):
                ChallengeAcceptScreen(code: code)
            case .challengeRound(let game, let invite):
                if game == .jigsaw { JigsawScreen(start: .deck, invite: invite) } else { QuizScreen(start: .poet, invite: invite) }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background { DottedPaper().ignoresSafeArea() }
    }
}
