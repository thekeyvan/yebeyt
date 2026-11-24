/// The games whose rounds the phone reports to the server (`game` of `ScoreRequest`), with the most one round can
/// score there. The caps are the server's (`GAME_CAPS` in apps/server/src/scores.ts); a round above its cap is
/// refused, so the phone clips it before sending.
enum ScoreGame: String, Codable, CaseIterable, Sendable {
    case daily, jigsaw, poet, second, book, match, listen, onboarding

    /// The most points of one round: معمای امروز 100, جورچین 20 × 10 + 120, the quiz games 10 × 44, معنی‌یاب 50,
    /// گوش کن 100, the onboarding game 50.
    var cap: Int {
        switch self {
        case .daily: 100
        case .jigsaw: 20 * 10 + 120
        case .poet, .second, .book: 10 * 44
        case .match: 50
        case .listen: 100
        case .onboarding: 50
        }
    }

    /// nil for the games with friends: the server records those itself.
    init?(_ kind: GameKind) {
        switch kind {
        case .daily: self = .daily
        case .jigsaw: self = .jigsaw
        case .poet: self = .poet
        case .misra: self = .second
        case .book: self = .book
        case .match: self = .match
        case .listen: self = .listen
        case .mosh, .duel: return nil
        }
    }

    func clipped(_ points: Int) -> Int { min(max(0, points), cap) }
}
