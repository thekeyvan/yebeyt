import Foundation

/// Makes the questions of the quiz games. Everything random goes through the generator, so a seed gives the same
/// question again (the tests rely on it).
enum QuizMaker {
    /// The last two letters of a hemistich once normalised and without spaces: «گوهرند» → «ند». Two hemistichs with
    /// the same ending rhyme in a way that makes a guess hard.
    static func ending(of text: String) -> String {
        String(TextNormalizer.normalize(text).filter { !$0.isWhitespace }.suffix(2))
    }

    /// حدس شاعر: the couplet's poet and three others, the poets of the same century first, then any.
    static func poet(_ couplet: GameCouplet, poets: [LibraryPoet], generator: inout SeededGenerator) -> QuizQuestion? {
        guard let own = poets.first(where: { $0.slug == couplet.poetSlug }) else { return nil }
        let others = poets.filter { $0.slug != own.slug && $0.name != own.name }
        let sameCentury = own.century == nil ? [] : others.filter { $0.century == own.century }
        let rest = others.filter { !sameCentury.contains($0) }
        var names: Set<String> = [own.name]
        var chosen: [LibraryPoet] = []
        for poet in generator.shuffled(sameCentury) + generator.shuffled(rest) {
            guard chosen.count < 3 else { break }
            if names.insert(poet.name).inserted { chosen.append(poet) }
        }
        guard chosen.count == 3 else { return nil }
        let options = generator.shuffled([own] + chosen).map { QuizOption(id: $0.slug, title: $0.name) }
        return QuizQuestion(kind: .poet, couplet: couplet, options: options, correct: options.firstIndex { $0.id == own.slug } ?? 0)
    }

    /// مصراع دوم (and گوش کن, with a clip): the right second hemistich and two of the same poet's other couplets,
    /// the ones with the same ending first.
    static func second(
        _ couplet: GameCouplet, pool: [GameCouplet], kind: GameKind = .misra, clip: ListenClip? = nil, generator: inout SeededGenerator
    ) -> QuizQuestion? {
        var seen: Set<String> = [TextNormalizer.normalize(couplet.m2)]
        let rhyme = ending(of: couplet.m2)
        var same: [GameCouplet] = [], other: [GameCouplet] = []
        for candidate in pool where candidate.poetSlug == couplet.poetSlug && candidate.id != couplet.id {
            let key = TextNormalizer.normalize(candidate.m2)
            guard !key.isEmpty, seen.insert(key).inserted else { continue }
            if ending(of: candidate.m2) == rhyme { same.append(candidate) } else { other.append(candidate) }
        }
        let wrong = Array((generator.shuffled(same) + generator.shuffled(other)).prefix(2))
        guard wrong.count == 2 else { return nil }
        let options = generator.shuffled([couplet] + wrong).map { QuizOption(id: $0.id, title: TextNormalizer.plain($0.m2)) }
        let correct = options.firstIndex { $0.id == couplet.id } ?? 0
        var question = QuizQuestion(kind: kind, couplet: couplet, options: options, correct: correct)
        if let clip {
            question.clip = clip
            question.hintWord = hintWord(in: options[correct].title, generator: &generator)
        }
        return question
    }

    /// گوش کن: a مصراع دوم question that also plays the first hemistich.
    static func listen(_ couplet: GameCouplet, pool: [GameCouplet], clip: ListenClip, generator: inout SeededGenerator) -> QuizQuestion? {
        second(couplet, pool: pool, kind: .listen, clip: clip, generator: &generator)
    }

    /// The word «یه کلمه» shows: one of three letters or more when there is one.
    private static func hintWord(in text: String, generator: inout SeededGenerator) -> Int {
        let words = text.split(whereSeparator: \.isWhitespace).map(String.init)
        let long = words.indices.filter { TextNormalizer.normalize(words[$0]).count >= 3 }
        let candidates = long.isEmpty ? Array(words.indices) : long
        return candidates.isEmpty ? 0 : generator.shuffled(candidates)[0]
    }

    /// از کدوم کتاب؟: the book of the couplet and up to two other books of its poet (curated books).
    static func book(_ couplet: GameCouplet, books: [LibraryBook], generator: inout SeededGenerator) -> QuizQuestion? {
        let own = books.filter { $0.poet == couplet.poetSlug }
        guard own.count >= 2, let right = own.first(where: { $0.path == couplet.bookPath }) else { return nil }
        let wrong = generator.shuffled(own.filter { $0.path != right.path }).prefix(2)
        let options = generator.shuffled([right] + wrong).map { QuizOption(id: $0.path, title: $0.title) }
        return QuizQuestion(kind: .book, couplet: couplet, options: options, correct: options.firstIndex { $0.id == right.path } ?? 0)
    }
}

extension QuizRound {
    static let questionCount = 10

    /// حدس شاعر: ten couplets of the deck.
    static func poet(deck: GameDeck, poets: [LibraryPoet], generator: inout SeededGenerator) -> QuizRound? {
        make(.poet, from: deck.couplets, generator: &generator) { couplet, generator in
            QuizMaker.poet(couplet, poets: poets, generator: &generator)
        }
    }

    /// مصراع دوم: ten couplets of the deck, or of one poet only (a poet with few couplets gets a shorter round).
    static func second(deck: GameDeck, only poet: String?, generator: inout SeededGenerator) -> QuizRound? {
        let pool = poet.map { slug in deck.couplets.filter { $0.poetSlug == slug } } ?? deck.couplets
        return make(.misra, from: pool, generator: &generator) { couplet, generator in
            QuizMaker.second(couplet, pool: pool, generator: &generator)
        }
    }

    /// از کدوم کتاب؟: ten couplets of poets with two or more curated books.
    static func book(deck: GameDeck, books: [LibraryBook], generator: inout SeededGenerator) -> QuizRound? {
        make(.book, from: deck.couplets, generator: &generator) { couplet, generator in
            QuizMaker.book(couplet, books: books, generator: &generator)
        }
    }

    private static func make(
        _ kind: GameKind, from couplets: [GameCouplet], generator: inout SeededGenerator,
        question: (GameCouplet, inout SeededGenerator) -> QuizQuestion?
    ) -> QuizRound? {
        var questions: [QuizQuestion] = []
        for couplet in generator.shuffled(couplets) where questions.count < questionCount {
            if let made = question(couplet, &generator) { questions.append(made) }
        }
        return QuizRound(kind: kind, questions: questions)
    }
}
