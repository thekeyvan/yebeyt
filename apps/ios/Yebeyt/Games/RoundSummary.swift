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
    let subtitle: String
    let rows: [Row]
}

private func clockText(_ seconds: Int) -> String {
    "\(PersianDigits.string(seconds / 60)):\(PersianDigits.string(seconds % 60 / 10))\(PersianDigits.string(seconds % 10))"
}

private func countText(_ count: Int, unit: String, poet: String?) -> String {
    "\(PersianDigits.string(count)) \(unit)" + (poet.map { " \($0)" } ?? "")
}

extension JigsawRound {
    var summary: RoundSummary {
        RoundSummary(
            points: totalPoints, right: rightCount, total: questions.count,
            subtitle: ["جورچین بیت", countText(questions.count, unit: "بیت", poet: singlePoet), clockText(elapsed)].joined(separator: " · "),
            rows: questions.enumerated().map { RoundSummary.Row(couplet: $1.couplet, result: $0 < answers.count ? answers[$0].result.isRight : nil) }
        )
    }
}

extension QuizRound {
    /// The poet's name when every couplet is by the same poet.
    var singlePoet: String? {
        Set(questions.map(\.couplet.poetSlug)).count == 1 ? questions[0].couplet.poetName : nil
    }

    var summary: RoundSummary {
        var parts = [kind.name, countText(questions.count, unit: "سؤال", poet: singlePoet)]
        switch clock {
        case .perQuestion: parts.append(clockText(answers.reduce(0) { $0 + $1.seconds }))
        case .round(let total): parts.append(clockText(total - roundLeft))
        case .none: break
        }
        return RoundSummary(
            points: points, right: rightCount, total: questions.count, subtitle: parts.joined(separator: " · "),
            rows: questions.enumerated().map { RoundSummary.Row(couplet: $1.couplet, result: $0 < answers.count ? answers[$0].right : nil) }
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
