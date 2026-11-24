import Foundation

/// What PlayMosh shows for a game, worked out from the game and who I am: whose turn, the letter to start with, the
/// scores, the time left. No screens, no clock of its own (`now` is given).
struct MoshState: Equatable {
    let game: FriendGame
    /// My username.
    let me: String

    var mine: GamePlayer? { game.player(me) }
    var other: GamePlayer? { game.other(than: me) }
    var isWaiting: Bool { game.status == .waiting }
    var isActive: Bool { game.status == .active }
    var isDone: Bool { game.status == .done }

    /// It is my turn in an active game.
    var isMyTurn: Bool { isActive && game.turn?.username == me }

    var myScore: Int { mine?.score ?? 0 }
    var theirScore: Int { other?.score ?? 0 }

    var lastMove: MoshMove? { game.moves.last }

    /// The letter the next couplet starts with: the last letter of the previous one. Nil for the first couplet, which is free.
    var requiredLetter: Character? { lastMove.flatMap { MoshLetters.last(of: $0.m2) } }

    /// The couplets already played, which may not be played again.
    var usedKeys: Set<String> { Set(game.moves.map(\.key)) }

    /// «دور ۸»: the couplet being asked for (the one after the played ones); after the end, the last one played.
    var round: Int { isDone ? max(game.moves.count, 1) : game.moves.count + 1 }

    /// «تا فردا», «۳۰ ثانیه», «۲ دقیقه».
    var turnLabel: String { PlayCopy.turnTime(seconds: game.turnSeconds) }

    /// «دور ۸ · تا فردا»
    var roundLine: String { "دور \(PersianDigits.string(round)) · \(turnLabel)" }

    /// Seconds left in the turn at `now`, nil when no turn is running.
    func secondsLeft(now: Date) -> Int? {
        guard isActive, let deadline = game.turn?.deadline else { return nil }
        return max(0, Int(deadline.timeIntervalSince(now).rounded(.up)))
    }

    /// The clock of the header: «۲۱ ساعت» for a game with a day to answer, «۰:۲۵» for the short ones.
    func timeLabel(now: Date) -> String? {
        secondsLeft(now: now).map { PlayCopy.timeLeft(seconds: $0, turnSeconds: game.turnSeconds) }
    }

    /// The line over the input: «نوبت توئه، با حرف «د»», «نوبت توئه؛ بیت اول رو بگو», or «منتظر سارا…».
    var turnLine: String {
        if isWaiting { return PlayCopy.waiting(for: other?.name ?? "") }
        if !isMyTurn { return PlayCopy.waiting(for: other?.name ?? "") }
        return requiredLetter.map { PlayCopy.myTurn(letter: $0) } ?? PlayCopy.myTurnFirst
    }

    /// The card of the بازی tab: «سارا جوابت رو داد», or «سارا اومد توی بازی» before anything was played.
    var cardTitle: String {
        let name = other?.name ?? ""
        return game.moves.isEmpty ? "\(name) اومد توی بازی" : "\(name) جوابت رو داد"
    }

    /// How a finished game ended, for the line and the title of the end.
    enum Outcome: Equatable {
        case won, lost, draw
    }

    var outcome: Outcome? {
        guard isDone else { return nil }
        guard let winner = game.winner else { return .draw }
        return winner == me ? .won : .lost
    }

    /// «بردی!», «سارا برد», «مساوی»
    var outcomeTitle: String? {
        outcome.map { PlayCopy.title($0, other: other?.name ?? "") }
    }

    /// Why it ended: «وقتت تموم شد», «سارا کم آورد», «سارا رفت». Nil for a game that ended by playing out.
    var endLine: String? {
        guard isDone, let reason = game.endReason else { return nil }
        let loserIsMe = game.winner != nil && game.winner != me
        let name = other?.name ?? ""
        switch reason {
        case .timeout: return loserIsMe ? "وقتت تموم شد" : "وقت \(name) تموم شد"
        case .resigned: return loserIsMe ? "کم آوردی" : "\(name) کم آورد"
        case .left: return "\(name) رفت"
        case .finished, .expired: return nil
        }
    }
}
