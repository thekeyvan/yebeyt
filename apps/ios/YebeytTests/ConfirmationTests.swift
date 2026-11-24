import Foundation
import Testing
@testable import Yebeyt

/// The rule of docs/yebeyt-2.md: ask first when an action loses progress or can't be undone; for a small action that is
/// easy to take back, act at once and offer «برگردون»; never ask when nothing is lost.
struct LeaveGameRuleTests {
    @Test func aRoundThatHasNotStartedLosesNothing() {
        #expect(!LeaveGame.asks(answered: 0, clockRuns: false, finished: false))
    }

    @Test func anAnswerOrARunningClockMeansTheRoundHasStarted() {
        #expect(LeaveGame.asks(answered: 1, clockRuns: false, finished: false))
        #expect(LeaveGame.asks(answered: 0, clockRuns: true, finished: false))
        #expect(LeaveGame.asks(answered: 4, clockRuns: true, finished: false))
    }

    @Test func nothingIsAskedOnceTheResultScreenShows() {
        #expect(!LeaveGame.asks(answered: 10, clockRuns: true, finished: true))
        #expect(!LeaveGame.asks(answered: 3, clockRuns: false, finished: true))
    }

    @Test func theQuestionIsTheLeadsCopy() {
        #expect(LeaveGame.title == "از بازی بری بیرون؟")
        #expect(LeaveGame.message == "نتیجه‌ی این دور ثبت نمی‌شه.")
        #expect(LeaveGame.leave == "برو بیرون")
        #expect(LeaveGame.stay == "بمون")
    }
}

@MainActor
struct LeaveGameSessionTests {
    private func quiz(_ kind: GameKind) -> QuizSession {
        let round = QuizRound(kind: kind, questions: (0..<3).map { QuizFixtures.question(kind, correct: $0 % 4) })!
        return QuizSession(round: round, stats: GameStats(defaults: GameFixtures.defaults()))
    }

    @Test func aJigsawRoundIsTimedFromTheStartAndStopsAskingWhenItIsOver() {
        var generator = SeededGenerator(seed: 1)
        let round = JigsawRound.make(opening: [], deck: GameFixtures.deck(60), generator: &generator)!
        let session = JigsawSession(round: round, stats: GameStats(defaults: GameFixtures.defaults()), seed: 3)
        #expect(session.asksBeforeLeaving, "the clock runs before the first answer")
        for _ in 0..<JigsawRound.duration { session.tick() }
        #expect(session.finished && !session.asksBeforeLeaving)
    }

    @Test func aTimedQuizRoundAsksFromTheStartButListeningWaitsForTheFirstAnswer() {
        #expect(quiz(.poet).asksBeforeLeaving)
        #expect(quiz(.misra).asksBeforeLeaving)
        #expect(quiz(.book).asksBeforeLeaving)

        let listen = quiz(.listen)
        #expect(!listen.asksBeforeLeaving, "no clock, no answer: nothing to lose")
        listen.select(listen.round.current.correct)
        listen.confirm()
        #expect(listen.asksBeforeLeaving)
    }

    @Test func aSkippedQuestionOfListeningIsNotAnAnswer() {
        let listen = quiz(.listen)
        listen.skip()
        #expect(!listen.asksBeforeLeaving)
    }

    @Test func aFinishedQuizRoundDoesNotAsk() {
        let listen = quiz(.listen)
        for _ in 0..<3 {
            listen.select(listen.round.current.correct)
            listen.confirm()
            listen.next()
        }
        #expect(listen.finished && !listen.asksBeforeLeaving)
    }

    @Test func matchAsksAfterTheFirstPairAndNotBeforeOrAfterTheEnd() {
        let session = MatchSession(round: MatchRound(questions: [MatchFixtures.question()])!, stats: GameStats(defaults: GameFixtures.defaults()))
        #expect(!session.asksBeforeLeaving)
        session.selectWord(0)
        _ = session.pick(meaning: 1)  // a wrong one is not a pair
        #expect(!session.asksBeforeLeaving)
        for id in 0..<5 {
            if session.round.selectedWord != id { session.selectWord(id) }
            _ = session.pick(meaning: id)
            if id == 0 { #expect(session.asksBeforeLeaving) }
        }
        session.next()
        #expect(session.finished && !session.asksBeforeLeaving)
    }
}

struct FriendConfirmationTests {
    @Test func onlyTakingARequestBackOrRejectingOneAsksFirst() {
        #expect(FriendAction.cancel.asksFirst && FriendAction.reject.asksFirst)
        #expect(!FriendAction.send.asksFirst && !FriendAction.accept.asksFirst)
    }

    @Test func theQuestionsAreTheLeadsCopy() {
        #expect(FriendCopy.cancelQuestion == "درخواستت رو پس بگیری؟")
        #expect(FriendCopy.cancelConfirm == "پس بگیر")
        #expect(FriendCopy.rejectQuestion == "درخواستش رو رد کنی؟")
        #expect(FriendCopy.rejectNote == "بهش خبر نمی‌دیم.")
        #expect(FriendCopy.rejectConfirm == "رد کن")
        #expect(FriendCopy.keep == "نه")
    }

    @Test func eachAskingActionHasItsOwnSheetWords() throws {
        let cancel = try #require(FriendCopy.confirmation(for: .cancel))
        #expect(cancel.title == FriendCopy.cancelQuestion && cancel.message == nil && cancel.confirm == "پس بگیر")
        let reject = try #require(FriendCopy.confirmation(for: .reject))
        #expect(reject.title == FriendCopy.rejectQuestion && reject.message == "بهش خبر نمی‌دیم." && reject.confirm == "رد کن")
        #expect(FriendCopy.confirmation(for: .send) == nil && FriendCopy.confirmation(for: .accept) == nil)
    }
}

struct SignOutQuestionTests {
    @Test func theQuestionStatesWhatHappensToTheDivanOnThePhone() {
        #expect(SignOutCopy.title == "از حسابت بیرون بری؟")
        #expect(SignOutCopy.message == "دیوانت به حسابت همگام می‌شه و از این گوشی پاک می‌شه؛ با ورود دوباره برمی‌گرده.")
        #expect(SignOutCopy.confirm == "بیرون برو" && SignOutCopy.stay == "نه")
    }
}

@MainActor
struct UndoToastTests {
    @Test func aToastCanCarryAnUndoThatGoesWithIt() {
        let model = AppModel()
        var undone = 0
        model.showToast(DivanCopy.removed, undo: ToastUndo { undone += 1 })
        #expect(model.toast == "از دیوانت برداشته شد" && model.toastUndo?.title == "برگردون")
        model.toastUndo?.run()
        #expect(undone == 1)
        model.toast = nil
        #expect(model.toastUndo == nil, "the way back goes when the line does")
    }

    @Test func aPlainToastDropsTheEarlierUndo() {
        let model = AppModel()
        model.showToast(DivanCopy.removed, undo: ToastUndo {})
        model.showToast("کپی شد")
        #expect(model.toast == "کپی شد" && model.toastUndo == nil)
    }
}

@MainActor
struct UnkeepUndoTests {
    private func marks() -> ReaderMarks { ReaderMarks(defaults: GameFixtures.defaults()) }

    @Test func takingACoupletOutActsAtOnceAndOffersTheWayBack() throws {
        let marks = marks()
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 1)
        var offered: (String, ToastUndo)?
        marks.toggleKept(poemPath: "/a/b/c", couplet: 1) { offered = ($0, $1) }
        #expect(!marks.contains(.kept, poemPath: "/a/b/c", couplet: 1))
        let (line, undo) = try #require(offered)
        #expect(line == "از دیوانت برداشته شد" && undo.title == "برگردون")
        undo.run()
        #expect(marks.contains(.kept, poemPath: "/a/b/c", couplet: 1))
    }

    @Test func keepingOffersNothing() {
        let marks = marks()
        var offered = 0
        marks.toggleKept(poemPath: "/a/b/c", couplet: 1) { _, _ in offered += 1 }
        #expect(marks.contains(.kept, poemPath: "/a/b/c", couplet: 1) && offered == 0)
    }

    @Test func theWayBackWinsTheSyncAndLeavesOtherCoupletsAlone() throws {
        let marks = marks()
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 1)
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 2)
        var undo: ToastUndo?
        marks.toggleKept(poemPath: "/a/b/c", couplet: 1) { undo = $1 }
        undo?.run()
        let item = try #require(marks.divanItems.first { $0.key == "/a/b/c#1" })
        #expect(item.isKept && (item.keptAt ?? 0) > (item.removedAt ?? 0), "kept after the removal, so the last change per couplet wins")
        #expect(marks.keptItems.count == 2)
    }

    @Test func aWayBackTakenAfterTheCoupletWasKeptAgainDoesNotTakeItOut() {
        let marks = marks()
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 1)
        var undo: ToastUndo?
        marks.toggleKept(poemPath: "/a/b/c", couplet: 1) { undo = $1 }
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 1)  // kept again by hand
        undo?.run()
        #expect(marks.contains(.kept, poemPath: "/a/b/c", couplet: 1))
    }
}

@MainActor
struct LeaveQuestionPausesTheClockTests {
    @Test func aJigsawClockWaitsWhileTheQuestionIsOpenAndGoesOnAfterStaying() {
        var generator = SeededGenerator(seed: 1)
        let round = JigsawRound.make(opening: [], deck: GameFixtures.deck(60), generator: &generator)!
        let session = JigsawSession(round: round, stats: GameStats(defaults: GameFixtures.defaults()), seed: 3)
        session.tick()
        #expect(session.round.timeLeft == JigsawRound.duration - 1)
        session.isAsking = true
        for _ in 0..<5 { session.tick() }
        #expect(session.round.timeLeft == JigsawRound.duration - 1)
        session.isAsking = false  // «بمون»
        session.tick()
        #expect(session.round.timeLeft == JigsawRound.duration - 2)
    }

    @Test func everyTimedQuizClockWaitsToo() {
        for kind in [GameKind.poet, .book, .misra] {
            let round = QuizRound(kind: kind, questions: (0..<3).map { QuizFixtures.question(kind, correct: $0 % 4) })!
            let session = QuizSession(round: round, stats: GameStats(defaults: GameFixtures.defaults()))
            session.tick()
            let left = session.round.timeLeft
            session.isAsking = true
            for _ in 0..<5 { session.tick() }
            #expect(session.round.timeLeft == left, "\(kind)")
            session.isAsking = false
            session.tick()
            #expect(session.round.timeLeft != left, "\(kind)")
        }
    }

    @Test func theQuestionAndTheRoundFlagsGoWhenTheGameChanges() {
        let app = AppModel()
        app.play(.quiz(.poet))
        app.gameAsksBeforeLeaving = true
        app.leaveQuestionOpen = true
        app.closeGame()
        #expect(!app.gameAsksBeforeLeaving && !app.leaveQuestionOpen)

        app.play(.quiz(.poet))
        app.gameAsksBeforeLeaving = true
        app.playWithCouplet(poem: "/hafez/ghazal/sh3", index: 0)
        #expect(!app.gameAsksBeforeLeaving, "the new game starts without a round")
    }
}

struct DailyRejectAndAvatarAndRecordingRulesTests {
    @Test func theQuestionsAreTheLeadsCopy() {
        #expect(HomeModel.rejectedLine == "امروز دیگه نشونت نمی‌دیم")
        #expect(FeedbackCopy.recordingTitle == "فیلم پاک بشه؟")
        #expect(FeedbackCopy.recordingDelete == "پاک کن" && FeedbackCopy.recordingKeep == "نه")
        #expect(AvatarCopy.title == "چهره‌ات ذخیره نشده. ولش کنی؟")
        #expect(AvatarCopy.discard == "ول کن" && AvatarCopy.stay == "بمون")
        #expect(UsernameRules.hint == "حروف انگلیسی، عدد، «_» و «.» · ۳ تا ۲۰ حرف · تا ۳۰ روز نمی‌شه عوضش کرد.")
    }

    @Test func aFaceAsksBeforeLeavingOnlyWhenTheDraftDiffersFromTheSavedOne() {
        let saved = AvatarParts.standard
        var draft = saved
        #expect(!AvatarScreen.asksBeforeLeaving(draft: draft, saved: saved))
        draft.hair = "black"
        #expect(AvatarScreen.asksBeforeLeaving(draft: draft, saved: saved))
    }
}

@MainActor
struct ToastTimingAndStartGameTests {
    @Test func anUndoToastStaysForVoiceOverAndOthersGoByThemselves() {
        #expect(ToastTiming.seconds(hasUndo: false, voiceOver: false) == 2.5)
        #expect(ToastTiming.seconds(hasUndo: false, voiceOver: true) == 2.5)
        #expect(ToastTiming.seconds(hasUndo: true, voiceOver: false) == 5)
        #expect(ToastTiming.seconds(hasUndo: true, voiceOver: true) == nil, "until it is dismissed or acted on")
    }

    @Test func everyToastShownCountsEvenWithTheSameLine() {
        let app = AppModel()
        let before = app.toastSerial
        app.showToast(DivanCopy.removed, undo: ToastUndo {})
        app.showToast(DivanCopy.removed, undo: ToastUndo {})
        #expect(app.toastSerial == before + 2, "the second one starts its time over")
    }

    @Test func theSwipeBackIsBlockedOnlyWhileTheScreenHasSomethingToLose() {
        #expect(SwipeBackDelegate.allows(stackDepth: 2, blocked: false))
        #expect(!SwipeBackDelegate.allows(stackDepth: 2, blocked: true))
        #expect(!SwipeBackDelegate.allows(stackDepth: 1, blocked: false))
    }

    @Test func anotherGameStartsAtOnceOrWaitsForTheLeaveQuestion() throws {
        let app = AppModel()
        var started = 0
        app.startGame { started += 1 }
        #expect(started == 1 && app.pendingGameStart == nil)

        app.gameAsksBeforeLeaving = true
        app.startGame { started += 1 }
        #expect(started == 1, "a round that has started waits for «برو بیرون»")
        let pending = try #require(app.pendingGameStart)
        pending.start()
        #expect(started == 2)
    }
}
