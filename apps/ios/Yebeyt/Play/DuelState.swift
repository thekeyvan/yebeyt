import Foundation

/// A game of رودررو as the live events tell it: the question in front, my answer, who answered, the rounds so far
/// and, at the end, the couplets. No screens and no clock of its own (`now` is given).
struct DuelState: Equatable {
    /// How a finished game ended.
    struct Ending: Equatable {
        var winner: String?
        var reason: FriendGame.EndReason
        var scores: [GameScore]
        var couplets: [DuelResult]
    }

    /// One bar of the round strip under «در برابر».
    enum Segment: Equatable {
        case won(by: String)
        case nobody
        case current
        case coming
    }

    static let roundCount = 5

    let gameID: String
    /// My username and the other player's.
    let me: String
    let other: String
    private(set) var question: DuelQuestion?
    private(set) var askedAt = Date.distantPast
    /// The option I chose in this round; nil before I answered.
    private(set) var chosen: Int?
    /// My answer was wrong: I am out of the round.
    private(set) var lockedOut = false
    /// The other player answered wrong and is out of the round (the «جواب داد» chip).
    private(set) var otherAnswered = false
    /// The right option, known when the round is over.
    private(set) var rightOption: Int?
    /// Who won each round played, by round number (nil: nobody).
    private(set) var winners: [Int: String?] = [:]
    private(set) var scores: [String: Int] = [:]
    private(set) var ending: Ending?

    init(gameID: String, me: String, other: String) {
        self.gameID = gameID
        self.me = me
        self.other = other
    }

    var myScore: Int { scores[me] ?? 0 }
    var theirScore: Int { scores[other] ?? 0 }
    var isEnded: Bool { ending != nil }

    /// The round on screen (1 to 5), 0 before the first question.
    var round: Int { question?.round ?? 0 }

    /// The question is open and I may still answer it.
    var canAnswer: Bool { question != nil && rightOption == nil && chosen == nil && !lockedOut && !isEnded }

    /// The round has a result: the right option is shown and nobody can answer.
    var isRoundOver: Bool { rightOption != nil }

    /// The winner of the round on screen once it is over (nil: nobody, or not over).
    var roundWinner: String? { winners[round] ?? nil }

    /// Seconds left in the round: the time the question came with, minus the time since.
    func secondsLeft(now: Date) -> Int {
        guard let question, !isRoundOver, !isEnded else { return 0 }
        let left = Double(question.deadlineMs) / 1000 - now.timeIntervalSince(askedAt)
        return max(0, Int(left.rounded(.up)))
    }

    /// The five bars: a round won by someone (in their colour), a round nobody won, the one in play, the ones to come.
    var segments: [Segment] {
        (1...Self.roundCount).map { number in
            if let winner = winners[number] { return winner.map { Segment.won(by: $0) } ?? .nobody }
            return number == max(round, 1) && !isEnded ? .current : .coming
        }
    }

    /// I choose an option (only while I can answer). Returns whether the answer is to be sent.
    @discardableResult
    mutating func choose(_ option: Int) -> Bool {
        guard canAnswer, let question, question.options.indices.contains(option) else { return false }
        chosen = option
        return true
    }

    /// My answer could not be sent: I may answer again.
    mutating func undoChoice() {
        if !lockedOut, !isRoundOver { chosen = nil }
    }

    mutating func apply(_ event: LiveEvent, now: Date = .now) {
        switch event {
        case .duelQuestion(let next) where next.gameId == gameID:
            // The server asks an open round again when a socket comes back: it is the same round, with the time that is left.
            let again = next.round == question?.round && rightOption == nil
            question = next
            askedAt = now
            if !again {
                chosen = nil
                lockedOut = false
                otherAnswered = false
                rightOption = nil
            }
        case .duelAnswered(let id, let round, let username) where id == gameID && round == self.round:
            if username == me { lockedOut = true } else { otherAnswered = true }
        case .duelRound(let id, let round, let winner, let right, let newScores) where id == gameID:
            winners[round] = .some(winner)
            rightOption = right
            take(newScores)
        case .gameEnded(let id, let winner, let reason, let newScores, let couplets) where id == gameID:
            take(newScores)
            ending = Ending(winner: winner, reason: reason, scores: newScores, couplets: couplets)
        default:
            break
        }
    }

    private mutating func take(_ list: [GameScore]) {
        for score in list { scores[score.username] = score.score }
    }

    // MARK: The end

    /// «بردی!», «سارا برد», «مساوی»; «سارا رفت» when the other left and I won.
    func endTitle(otherName: String) -> String? {
        guard let ending else { return nil }
        if ending.reason == .left, ending.winner == me { return PlayCopy.duelLeft(otherName) }
        guard let winner = ending.winner else { return PlayCopy.title(.draw, other: otherName) }
        return PlayCopy.title(winner == me ? .won : .lost, other: otherName)
    }
}

extension DuelState {
    /// The end-of-game screen's content: the result as the title, the rounds won, and the five couplets with their meanings
    /// (a green ✓ for a round I won, a red × for one the other won, a grey dot when nobody did). Nil before the end.
    func summary(otherName: String, poetName: (String) -> String) -> RoundSummary? {
        guard let ending, let title = endTitle(otherName: otherName) else { return nil }
        let rows = ending.couplets.compactMap { result -> RoundSummary.Row? in
            guard let (path, index) = CoupletKey.parse(result.key) else { return nil }
            let couplet = GameCouplet(
                poem: path, index: index, m1: result.m1, m2: result.m2, meaning: result.meaning, poetSlug: result.poet,
                poetName: poetName(result.poet), bookTitle: result.bookTitle
            )
            return RoundSummary.Row(couplet: couplet, result: result.winner.map { $0 == me })
        }
        return RoundSummary(
            points: 0, right: myScore, total: Self.roundCount, subtitle: PlayCopy.scores(mine: myScore, name: otherName, theirs: theirScore), rows: rows,
            title: title, showsPoints: false, showsMeanings: true
        )
    }
}
