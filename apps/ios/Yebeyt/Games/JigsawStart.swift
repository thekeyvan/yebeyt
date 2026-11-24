import Foundation

/// Where a جورچین بیت round starts: the couplets of the deck, or couplets of a poem the reader has open.
enum JigsawStart: Equatable, Sendable {
    case deck
    /// «بازی با این بیت»: that couplet first, then couplets from the deck.
    case couplet(poem: String, index: Int)
    /// «بازی با این غزل»: the couplets of that poem first, then couplets from the deck.
    case poem(String)
    /// A challenge: exactly these couplets, in this order.
    case items([GameCouplet])
}

extension JigsawStart {
    /// The couplets of `poem` the round starts with: the one asked for, or the playable ones in order.
    func opening(from poem: Poem, poetSlug: String, poetName: String, bookTitle: String) -> [GameCouplet] {
        let all = poem.couplets.enumerated().map { index, couplet in
            GameCouplet(poem: poem.path, index: index, couplet: couplet, poetSlug: poetSlug, poetName: poetName, bookTitle: bookTitle)
        }
        switch self {
        case .deck, .items: return []
        case .couplet(_, let index): return all.indices.contains(index) ? [all[index]] : []
        case .poem: return all
        }
    }
}

extension JigsawRound {
    /// The words other couplets lend as the extra stickers.
    private static let distractorSample = 40

    /// A round: the opening couplets that can be played, then deck couplets, ten in all.
    static func make(opening: [GameCouplet], deck: GameDeck, generator: inout SeededGenerator) -> JigsawRound? {
        var chosen = opening.filter(JigsawQuestion.canPlay).prefix(questionCount).map { $0 }
        let taken = Set(chosen.map(\.id))
        let fill = generator.shuffled(deck.couplets.filter { !taken.contains($0.id) })
        chosen += fill.prefix(questionCount - chosen.count)
        let pool = generator.shuffled(fill.prefix(distractorSample).flatMap { $0.m2.split(whereSeparator: \.isWhitespace).map(String.init) })
        let questions = chosen.compactMap { JigsawQuestion(couplet: $0, distractors: generator.shuffled(pool), generator: &generator) }
        return JigsawRound(questions: questions)
    }

    /// «۱۰ بیت سعدی»: the poet's name when every couplet is by the same poet.
    var singlePoet: String? { GameCouplet.singlePoet(of: questions.map(\.couplet)) }
}
