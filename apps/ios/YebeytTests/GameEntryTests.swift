import Testing
@testable import Yebeyt

struct GameEntryTests {
    @Test func everyGameButTheOnesWithFriendsOpens() {
        #expect(GameKind.allCases.filter { !$0.isBuilt } == [.mosh, .duel])
        #expect(GameKind.tabCards.allSatisfy { $0.isBuilt })
        #expect(GameKind.poet.route == .quiz(.poet))
        #expect(GameKind.misra.route == .quiz(.misra(poet: nil)))
        #expect(GameKind.book.route == .quiz(.book))
        #expect(GameKind.match.route == .match)
        #expect(GameKind.listen.route == .quiz(.listen))
        #expect(GameKind.jigsaw.route == .jigsaw(.deck))
    }

    @Test func eachRouteHasItsOwnIdSoOneGameReplacesAnother() {
        let routes: [GameRoute] = [.daily, .jigsaw(.deck), .quiz(.poet), .quiz(.misra(poet: nil)), .quiz(.misra(poet: "hafez")), .quiz(.book), .quiz(.listen), .match]
        #expect(Set(routes.map(\.id)).count == routes.count)
    }

    @Test func aStartKnowsItsGame() {
        #expect(QuizStart.misra(poet: "hafez").kind == .misra)
        #expect([QuizStart.poet, .book, .listen].map(\.kind) == [.poet, .book, .listen])
    }

    @Test func theLineUnderTheTitleFollowsTheBoards() {
        #expect(QuizCopy.subtitle(for: .poet, poetName: "حافظ") == "شاعرِ این بیت کیه؟")
        #expect(QuizCopy.subtitle(for: .misra, poetName: "حافظ") == "ادامه‌ی این بیت کدومه؟")
        #expect(QuizCopy.subtitle(for: .listen, poetName: "حافظ") == "مصراع اول رو بشنو؛ دومی کدومه؟")
        #expect(QuizCopy.subtitle(for: .book, poetName: "مولانا") == "این بیت از کدوم کتابِ مولاناست؟")
        #expect(QuizCopy.subtitle(for: .book, poetName: "خیام") == "این بیت از کدوم کتابِ خیامه؟")
        #expect(QuizCopy.subtitle(for: .book, poetName: "سعدی") == "این بیت از کدوم کتابِ سعدیه؟")
    }
}
