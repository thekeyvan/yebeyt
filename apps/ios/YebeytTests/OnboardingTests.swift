import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct OnboardingTests {
    private func model(start: OnboardingStep? = .welcome, defaults: UserDefaults = GameFixtures.defaults()) -> OnboardingModel {
        OnboardingModel(start: start, defaults: defaults)
    }

    @Test func theStepsFollowEachOtherAndTheLastEndsIt() {
        let defaults = GameFixtures.defaults()
        let onboarding = model(defaults: defaults)
        var seen: [OnboardingStep] = []
        while let step = onboarding.step {
            seen.append(step)
            if step == .username { onboarding.next() } else if step == .account { onboarding.signedIn(needsUsername: true) } else { onboarding.next() }
        }
        #expect(seen == [.welcome, .taste, .game, .account, .username, .friends])
        #expect(!onboarding.isRunning)
        #expect(defaults.bool(forKey: OnboardingModel.doneKey))
    }

    @Test func skipGoesOneStepOnAndTheAccountStepEndsIt() {
        let defaults = GameFixtures.defaults()
        let onboarding = model(start: .taste, defaults: defaults)
        onboarding.next()  // «رد شو» on the taste step
        #expect(onboarding.step == .game)
        onboarding.next()  // «رد شو» on the game
        #expect(onboarding.step == .account)
        #expect(!onboarding.gameWon)
        onboarding.next()  // «رد شو» on the account step: no account, to the home screen
        #expect(onboarding.step == nil)
        #expect(defaults.bool(forKey: OnboardingModel.doneKey))
    }

    @Test func aReturningPersonGoesStraightToTheAccountStep() {
        let onboarding = model()
        onboarding.signIn()
        #expect(onboarding.step == .account)
        onboarding.signedIn(needsUsername: false)  // they have a username already: nothing more to ask
        #expect(onboarding.step == nil)
    }

    @Test func aNewAccountPicksAUsernameThenSeesTheInviteLink() {
        let onboarding = model(start: .account)
        onboarding.signedIn(needsUsername: true)
        #expect(onboarding.step == .username)
        onboarding.next()
        #expect(onboarding.step == .friends)
        onboarding.finish()
        #expect(onboarding.step == nil)
    }

    @Test func aWonGameIsRememberedForTheAccountStep() {
        let onboarding = model(start: .game)
        onboarding.gameEnded(won: true)
        #expect(onboarding.step == .account)
        #expect(onboarding.gameWon)
        let lost = model(start: .game)
        lost.gameEnded(won: false)
        #expect(lost.step == .account && !lost.gameWon)
    }

    @Test func eventsFromOtherStepsAreIgnored() {
        let onboarding = model(start: .welcome)
        onboarding.gameEnded(won: true)
        onboarding.signedIn(needsUsername: true)
        #expect(onboarding.step == .welcome && !onboarding.gameWon)
        onboarding.signIn()
        onboarding.signIn()
        #expect(onboarding.step == .account)
    }

    @Test func signingInMarksOnboardingDoneSoARestartKeepsTheAccount() {
        let defaults = GameFixtures.defaults()
        let onboarding = model(start: .account, defaults: defaults)
        onboarding.signedIn(needsUsername: true)
        #expect(OnboardingModel.firstLaunchStep(defaults: defaults) == nil)
    }

    @Test func aFirstLaunchForgetsATokenLeftByAnEarlierInstall() {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        defer { keychain.delete() }
        keychain.write("old")
        AccountSetup.forgetStaleSession(start: nil, keychain: keychain)  // not a first launch
        #expect(keychain.read() == "old")
        AccountSetup.forgetStaleSession(start: .welcome, keychain: keychain)
        #expect(keychain.read() == nil)
    }

    @Test func onboardingShowsOnTheFirstLaunchOnly() {
        let defaults = GameFixtures.defaults()
        #expect(OnboardingModel.firstLaunchStep(defaults: defaults) == .welcome)
        model(start: .welcome, defaults: defaults).finish()
        #expect(OnboardingModel.firstLaunchStep(defaults: defaults) == nil)
    }

    @Test func theBarCoversTasteGameAndAccountOnly() {
        #expect(OnboardingStep.allCases.map(\.barIndex) == [nil, 0, 1, 2, nil, nil])
        #expect(OnbTopBar.labels == ["سلیقه", "اولین بازی", "حساب"])
    }
}

@MainActor
struct TasteTests {
    @Test func choicesAreKeptOnThePhone() {
        let defaults = GameFixtures.defaults()
        let taste = Taste(defaults: defaults)
        taste.toggle(poet: "hafez")
        taste.toggle(poet: "saadi")
        taste.toggle(poet: "saadi")  // a second tap takes it back
        taste.toggle(mood: .love)
        taste.toggle(mood: .longing)
        #expect(taste.poets == ["hafez"])
        let again = Taste(defaults: defaults)
        #expect(again.poets == ["hafez"])
        #expect(again.moods == [.love, .longing])
        #expect(Taste.savedPoets(in: defaults) == ["hafez"])
    }

    @Test func theMoodsAreTheBoardsInItsOrder() {
        #expect(TasteMood.allCases.map(\.title) == ["عاشقانه", "امید", "دلتنگی", "عرفانی", "طنز", "حماسی", "طبیعت"])
    }

    private func poem(_ path: String, recitations: Int = 1) -> IndexedPoem {
        IndexedPoem(id: 1, catId: 1, path: path, first: "", couplets: 1, rhyme: "", recitations: recitations, number: 1)
    }

    @Test func theDailyCoupletPrefersThePoetsPickedWhenTheyAreInThePool() {
        let pool = [poem("/hafez/ghazal/sh1"), poem("/khayyam/robaee/r1"), poem("/hafez/ghazal/sh2")]
        #expect(DailyPick.preferring(["hafez"], in: pool).map(\.path) == ["/hafez/ghazal/sh1", "/hafez/ghazal/sh2"])
        #expect(DailyPick.preferring(["saadi"], in: pool) == pool)  // none of theirs is bundled: the whole pool
        #expect(DailyPick.preferring([], in: pool) == pool)
    }
}

@MainActor
struct OnboardingGameTests {
    private func couplets() -> [GameCouplet] {
        [
            GameFixtures.couplet(1, m2: "که در آفرینش ز یک گوهرند", poet: "saadi"),  // five words
            GameFixtures.couplet(2, m2: "که عشق آسان نمود اول ولی افتاد مشکل‌ها", poet: "hafez"),  // eight words: too long
            GameFixtures.couplet(3, m2: "چو عضوی به درد آورد روزگار", poet: "saadi"),
            GameFixtures.couplet(4, m2: "دو", poet: "hafez"),  // too short to play
            GameFixtures.couplet(5, m2: "به نام خداوند جان و خرد", poet: "ferdousi"),
        ]
    }

    private func makeGame(preferring poets: Set<String> = [], seed: UInt64 = 3) throws -> OnboardingGame {
        var generator = SeededGenerator(seed: seed)
        return try #require(OnboardingGame.make(deck: GameDeck(couplets: couplets()), preferring: poets, generator: &generator))
    }

    @Test func itPlaysAShortCoupletOfAPoetThePersonPicked() throws {
        for seed in 1...12 as ClosedRange<UInt64> {
            let game = try makeGame(preferring: ["ferdousi"], seed: seed)
            #expect(game.board.question.couplet.poetSlug == "ferdousi")
            let any = try makeGame(seed: seed)
            #expect((4...6).contains(any.board.question.words.count))
        }
    }

    @Test func withNoShortCoupletThereIsNoGame() {
        var generator = SeededGenerator(seed: 1)
        let deck = GameDeck(couplets: [GameFixtures.couplet(1, m2: "یک دو")])
        #expect(OnboardingGame.make(deck: deck, preferring: [], generator: &generator) == nil)
    }

    private func solve(_ game: OnboardingGame) {
        let question = game.board.question
        for position in question.missing {
            let sticker = game.board.onSheet.first { $0.word == question.words[position] }!
            game.edit { $0.place(sticker, at: position) }
        }
    }

    @Test func stickingTheRightWordsWins() throws {
        let game = try makeGame()
        #expect(game.leftCount == game.board.question.missing.count)
        game.check()  // nothing is placed yet
        #expect(!game.isOver)
        solve(game)
        #expect(game.leftCount == 0)
        game.check()
        #expect(game.outcome == .won)
        #expect(OnboardingGame.reward == 50)
    }

    @Test func aWrongTryTakesTheWrongStickersBackAndGoesOn() throws {
        let game = try makeGame()
        let question = game.board.question
        let wrong = game.board.onSheet.first { sticker in !question.missing.contains { question.words[$0] == sticker.word } }!
        for position in question.missing {
            let sticker = position == question.missing[0] ? wrong : game.board.onSheet.first { $0.word == question.words[position] }!
            game.edit { $0.place(sticker, at: position) }
        }
        game.check()
        #expect(game.outcome == nil)
        #expect(game.board.word(at: question.missing[0]) == nil)  // the wrong one went back to the sheet
        #expect(game.leftCount == 1)
    }

    @Test func thirtySecondsAndItsOver() throws {
        let game = try makeGame()
        for _ in 0..<(OnboardingGame.duration - 1) { game.tick() }
        #expect(game.outcome == nil)
        game.tick()
        #expect(game.outcome == .timedOut)
        let before = game.board
        game.edit { $0.select(before.onSheet[0]) }  // nothing changes after the end
        game.tick()
        #expect(game.board == before)
        #expect(game.timeLeft == 0)
    }

    @Test func theProgressLineReadsLikeTheBoard() throws {
        let game = try makeGame()
        let words = game.board.question.words.count
        let missing = game.board.question.missing.count
        let names = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت"]
        #expect(game.progressLine == "\(names[words - missing]) تا درست، \(names[missing]) تا مونده!")
    }
}
