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

private func countText(_ couplets: [GameCouplet], unit: String) -> String {
    "\(PersianDigits.string(couplets.count)) \(unit)" + (GameCouplet.singlePoet(of: couplets).map { " \($0)" } ?? "")
}

extension JigsawRound {
    var summary: RoundSummary {
        RoundSummary(
            points: totalPoints, right: rightCount, total: questions.count,
            subtitle: ["جورچین بیت", countText(questions.map(\.couplet), unit: "بیت"), PersianDigits.clock(elapsed)].joined(separator: " · "),
            rows: questions.enumerated().map { RoundSummary.Row(couplet: $1.couplet, result: $0 < answers.count ? answers[$0].result.isRight : nil) }
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
            rows: questions.enumerated().map { RoundSummary.Row(couplet: $1.couplet, result: $0 < results.count ? results[$0] : nil) }
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
