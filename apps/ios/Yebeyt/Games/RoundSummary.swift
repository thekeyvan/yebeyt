import Foundation

/// What the end-of-round screen shows, whatever the game: the points, how many were right, a line about the round
/// and the round's couplets (a nil result is a couplet the time ran out before).
struct RoundSummary {
    struct Row {
        let couplet: GameCouplet
        let result: Bool?
    }

    let points: Int
    let right: Int
    let total: Int
    var subtitle: String
    let rows: [Row]
    /// The big word: «تموم شد!», or the result of a game with a friend.
    var title = "تموم شد!"
    /// The amber «+۳۲۰ امتیاز» sticker (a game with a friend gives league points, not these).
    var showsPoints = true
    /// The couplets as rows. A signed-in person who finished جورچین or حدس شاعر sees the challenge card instead.
    var showsCouplets = true
    /// A line with the meaning under each couplet (رودررو).
    var showsMeanings = false
    /// What a challenge made from this round is, when the round can be one.
    var offer: ChallengeOffer?
    /// A game against someone: whether I won it. Nil for a solo round.
    var won: Bool?

    /// Worth a burst: a game won, or a solo round with at least half right.
    var celebrates: Bool { won ?? (right * 2 >= total) }
}

extension RoundSummary {
    /// The same summary, with a challenge made from it going to these friends.
    func inviting(_ usernames: [String]) -> RoundSummary {
        var copy = self
        copy.offer?.invite = usernames
        return copy
    }
}

/// The ten couplets of a finished جورچین or حدس شاعر round, the score and the time: what a challenge is made of.
struct ChallengeOffer: Equatable {
    var game: ChallengeGame
    /// The couplet keys, in the order they were played.
    var items: [String]
    var score: Int
    var seconds: Int
    /// The first couplet, shown on the preview card.
    var first: GameCouplet
    /// «۱۰ بیت سعدی» when all ten are by one poet.
    var label: String?
    /// The friends picked in the lobby: the challenge goes to them once it is made.
    var invite: [String] = []

    static let itemCount = 10

    /// The server takes only couplets of the game deck: a round with one from a poem the reader had open is no challenge.
    func isInDeck(_ deck: GameDeck) -> Bool { items.allSatisfy(deck.keys.contains) }

    /// The offer of a round of `couplets`; nil unless there are exactly ten.
    init?(game: ChallengeGame, couplets: [GameCouplet], score: Int, seconds: Int) {
        guard couplets.count == Self.itemCount, let first = couplets.first else { return nil }
        self.game = game
        items = couplets.map(\.id)
        self.score = score
        self.seconds = seconds
        self.first = first
        label = GameCouplet.singlePoet(of: couplets).map { "\(PersianDigits.string(couplets.count)) بیت \($0)" }
    }
}

private func countText(_ couplets: [GameCouplet], unit: String) -> String {
    "\(PersianDigits.string(couplets.count)) \(unit)" + (GameCouplet.singlePoet(of: couplets).map { " \($0)" } ?? "")
}

extension JigsawRound {
    var summary: RoundSummary {
        RoundSummary(
            points: totalPoints, right: rightCount, total: questions.count,
            subtitle: ["جورچین بیت", countText(questions.map(\.couplet), unit: "بیت"), PersianDigits.clock(elapsed)].joined(separator: " · "),
            rows: questions.enumerated().map { RoundSummary.Row(couplet: $1.couplet, result: $0 < answers.count ? answers[$0].result.isRight : nil) },
            offer: ChallengeOffer(game: .jigsaw, couplets: questions.map(\.couplet), score: rightCount, seconds: elapsed)
        )
    }
}

extension QuizRound {
    var summary: RoundSummary {
        var parts = [kind.name, countText(questions.map(\.couplet), unit: "سؤال")]
        switch clock {
        case .perQuestion: parts.append(PersianDigits.clock(answers.reduce(0) { $0 + $1.seconds }))
        case .round(let total): parts.append(PersianDigits.clock(total - roundLeft))
        case .none: break
        }
        let results = results
        return RoundSummary(
            points: points, right: rightCount, total: questions.count, subtitle: parts.joined(separator: " · "),
            rows: questions.enumerated().map { RoundSummary.Row(couplet: $1.couplet, result: $0 < results.count ? results[$0] : nil) },
            offer: kind == .poet ? ChallengeOffer(game: .poet, couplets: questions.map(\.couplet), score: rightCount, seconds: answers.reduce(0) { $0 + $1.seconds }) : nil
        )
    }
}

extension MatchRound {
    var summary: RoundSummary {
        RoundSummary(
            points: points, right: results.count, total: questions.count,
            subtitle: "\(GameKind.match.name) · \(PersianDigits.string(pairs)) جفت",
            rows: questions.enumerated().map { RoundSummary.Row(couplet: $1.couplet, result: $0 < results.count ? true : nil) }
        )
    }
}
