import XCTest

/// The questions the app asks before something that loses progress or can't be undone, and the undo toast for the small
/// things that are easy to take back (docs/yebeyt-2.md, «Asking before it hurts»). Each question is attached as a screenshot.
final class ConfirmationsUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String], signedIn: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: the fake sign-in and the fake server answer on the phone.
        app.launchArguments = ["-beytFresh", "1", "-beytToday", "2026-11-23", "-beytAPI", "http://127.0.0.1:9", "-beytStub", "1"]
            + (signedIn ? ["-beytSignedIn", "1"] : []) + arguments
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    @MainActor private func waitForDisappearance(of element: XCUIElement, timeout: TimeInterval = 8) -> Bool {
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element)
        return XCTWaiter().wait(for: [gone], timeout: timeout) == .completed
    }

    @MainActor private func shot(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    // MARK: Closing a game

    @MainActor func testClosingAStartedSoloGameAsksAndStayingKeepsTheGame() {
        let app = launch(["-beytRoute", "jigsaw"])  // the clock runs from the first second
        let close = app.buttons["gameClose"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        close.tap()

        let title = app.staticTexts["leaveGameTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertEqual(title.label, "از بازی بری بیرون؟")
        XCTAssertEqual(app.staticTexts["leaveGameMessage"].label, "نتیجه‌ی این دور ثبت نمی‌شه.")
        XCTAssertEqual(app.buttons["leaveGameCancel"].label, "بمون")
        XCTAssertEqual(app.buttons["leaveGameConfirm"].label, "برو بیرون")
        assertSheetFits(app, title: title, lastButton: app.buttons["leaveGameConfirm"])
        shot(app, "leave-game")

        app.buttons["leaveGameCancel"].tap()  // «بمون»
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(element(app, "score").exists, "the round goes on")
        XCTAssertTrue(close.exists)
    }

    @MainActor func testGoingOutOfAStartedSoloGameLeaves() {
        let app = launch(["-beytRoute", "jigsaw"])
        app.buttons["gameClose"].tap()
        let confirm = app.buttons["leaveGameConfirm"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()  // «برو بیرون»
        XCTAssertTrue(waitForDisappearance(of: app.buttons["gameClose"]))
        XCTAssertFalse(app.staticTexts["leaveGameTitle"].exists)
    }

    @MainActor func testClosingBeforeTheFirstAnswerLeavesWithoutAQuestion() {
        let app = launch(["-beytRoute", "match"])  // no clock, no pair yet: nothing to lose
        XCTAssertTrue(app.buttons["word-0"].waitForExistence(timeout: 10))
        app.buttons["gameClose"].tap()
        XCTAssertTrue(waitForDisappearance(of: app.buttons["gameClose"]))
        XCTAssertFalse(app.staticTexts["leaveGameTitle"].exists)
    }

    @MainActor func testTheDailyPuzzleKeepsItsTriesSoClosingItAsksNothing() {
        let app = launch(["-beytRoute", "daily", "-beytPlay", "1"])
        XCTAssertTrue(app.buttons["submit"].waitForExistence(timeout: 10))
        app.buttons["gameClose"].tap()
        XCTAssertTrue(waitForDisappearance(of: app.buttons["gameClose"]))
        XCTAssertFalse(app.staticTexts["leaveGameTitle"].exists)
    }

    // MARK: Friend requests

    @MainActor func testTakingARequestBackAsksFirstAndSayingNoKeepsIt() {
        let app = launch(["-beytRoute", "person:paria"], signedIn: true)  // I asked her
        let cancel = app.buttons["person-cancel"]
        XCTAssertTrue(cancel.waitForExistence(timeout: 10))
        cancel.tap()
        let title = app.staticTexts["cancelRequestTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertEqual(title.label, "درخواستت رو پس بگیری؟")
        XCTAssertEqual(app.buttons["cancelRequestCancel"].label, "نه")
        XCTAssertEqual(app.buttons["cancelRequestConfirm"].label, "پس بگیر")
        assertSheetFits(app, title: title, lastButton: app.buttons["cancelRequestConfirm"])
        shot(app, "cancel-request")
        app.buttons["cancelRequestCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(cancel.exists, "«نه» keeps the request")

        cancel.tap()
        app.buttons["cancelRequestConfirm"].tap()
        XCTAssertTrue(app.buttons["person-send"].waitForExistence(timeout: 10))
    }

    @MainActor func testRejectingARequestAsksFirstAndTellsNoOne() {
        let app = launch(["-beytRoute", "person:aryan"], signedIn: true)  // he asked me
        let reject = app.buttons["person-reject"]
        XCTAssertTrue(reject.waitForExistence(timeout: 10))
        reject.tap()
        let title = app.staticTexts["rejectRequestTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertEqual(title.label, "درخواستش رو رد کنی؟")
        XCTAssertEqual(app.staticTexts["rejectRequestMessage"].label, "بهش خبر نمی‌دیم.")
        XCTAssertEqual(app.buttons["rejectRequestConfirm"].label, "رد کن")
        assertSheetFits(app, title: title, lastButton: app.buttons["rejectRequestConfirm"])
        shot(app, "reject-request")
        app.buttons["rejectRequestCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(reject.exists)

        reject.tap()
        app.buttons["rejectRequestConfirm"].tap()
        XCTAssertTrue(app.buttons["person-send"].waitForExistence(timeout: 10))
    }

    // MARK: Signing out

    @MainActor func testTheSignOutQuestionIsShown() {
        let app = launch(["-beytRoute", "settings", "-beytSeedDivan", "1"], signedIn: true)
        app.buttons["signOut"].tap()
        let title = app.staticTexts["signOutAskTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        assertSheetFits(app, title: title, lastButton: app.buttons["signOutAskConfirm"])
        shot(app, "sign-out")
    }

    // MARK: The divan

    @MainActor func testTakingACoupletOutOfTheDivanShowsAnUndoToastAndTheWayBackRestoresIt() {
        let app = launch(["-beytRoute", "divan", "-beytSeedDivan", "1"])
        let unkeep = app.buttons["unkeep-/hafez/ghazal/sh1#0"]
        XCTAssertTrue(unkeep.waitForExistence(timeout: 10))
        unkeep.tap()  // at once, with no question
        XCTAssertTrue(waitForDisappearance(of: unkeep))
        XCTAssertFalse(app.staticTexts["unkeepTitle"].exists)

        let toast = app.staticTexts["از دیوانت برداشته شد"]
        XCTAssertTrue(toast.waitForExistence(timeout: 5))
        let undo = app.buttons["toastUndo"]
        XCTAssertTrue(undo.exists)
        XCTAssertEqual(undo.label, "برگردون")
        shot(app, "unkeep-toast")

        undo.tap()
        XCTAssertTrue(app.buttons["unkeep-/hafez/ghazal/sh1#0"].waitForExistence(timeout: 10), "the couplet is back")
        XCTAssertTrue(waitForDisappearance(of: toast))
    }

    // MARK: Feedback

    @MainActor func testClosingTheFeedbackFormWithTextAsksAndSwipingDownDoesNotThrowItAway() {
        let app = launch(["-beytFeedback", "idea"])
        let field = element(app, "feedbackText")
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText("یه ایده")

        app.buttons["feedbackClose"].tap()
        let title = app.staticTexts["feedbackDiscardTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertEqual(title.label, "بازخوردت هنوز فرستاده نشده. ولش کنی؟")
        XCTAssertEqual(app.buttons["feedbackDiscardCancel"].label, "بمون")
        XCTAssertEqual(app.buttons["feedbackDiscardConfirm"].label, "ول کن")
        assertSheetFits(app, title: title, lastButton: app.buttons["feedbackDiscardConfirm"])
        shot(app, "feedback-discard")
        app.buttons["feedbackDiscardCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(field.exists)

        // A swipe down with text in the form can't close it: it asks instead.
        let window = app.windows.firstMatch
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.125))
            .press(forDuration: 0.1, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95)))
        XCTAssertTrue(app.staticTexts["feedbackDiscardTitle"].waitForExistence(timeout: 10))
        app.buttons["feedbackDiscardCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: app.staticTexts["feedbackDiscardTitle"]))
        XCTAssertTrue(field.exists)

        app.buttons["feedbackClose"].tap()
        app.buttons["feedbackDiscardConfirm"].tap()  // «ول کن»
        XCTAssertTrue(waitForDisappearance(of: field))
    }

    @MainActor func testClosingAnEmptyFeedbackFormAsksNothing() {
        let app = launch(["-beytFeedback", "idea"])
        XCTAssertTrue(element(app, "feedbackText").waitForExistence(timeout: 10))
        app.buttons["feedbackClose"].tap()
        XCTAssertTrue(waitForDisappearance(of: element(app, "feedbackText")))
        XCTAssertFalse(app.staticTexts["feedbackDiscardTitle"].exists)
    }

    // MARK: The clock waits, and another game from the reader asks too

    @MainActor func testTheGameClockWaitsWhileTheQuestionIsOpenAndRunsAgainAfterStaying() {
        let app = launch(["-beytRoute", "jigsaw"])
        let timer = element(app, "timer")
        XCTAssertTrue(timer.waitForExistence(timeout: 10))
        app.buttons["gameClose"].tap()
        XCTAssertTrue(app.staticTexts["leaveGameTitle"].waitForExistence(timeout: 10))
        let frozen = timer.value as? String
        sleep(3)
        XCTAssertEqual(timer.value as? String, frozen, "the clock waits for the answer")
        app.buttons["leaveGameCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: app.staticTexts["leaveGameTitle"]))
        sleep(3)
        XCTAssertNotEqual(timer.value as? String, frozen, "«بمون» lets it run again")
    }

    @MainActor func testStartingAnotherGameFromTheReaderOverAStartedRoundAsksFirst() {
        let app = launch(["-beytRoute", "jigsaw-result"])
        let poem = app.buttons["sheetPoem"]
        XCTAssertTrue(poem.waitForExistence(timeout: 10))
        poem.tap()
        let another = app.buttons["بازی با این غزل"]
        XCTAssertTrue(another.waitForExistence(timeout: 10))
        another.tap()
        let title = app.staticTexts["leaveGameTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        assertSheetFits(app, title: title, lastButton: app.buttons["leaveGameConfirm"])
        shot(app, "leave-game-from-reader")
        app.buttons["leaveGameCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(another.exists, "«بمون» stays in the reader")

        another.tap()
        app.buttons["leaveGameConfirm"].tap()
        XCTAssertTrue(waitForDisappearance(of: another), "the reader closes and the new game starts")
    }

    // MARK: Today's couplet

    @MainActor func testRejectingTodaysCoupletActsAtOnceAndTheWayBackBringsItBack() {
        let app = launch(["-beytTab", "home"])
        let card = app.buttons["dailyCouplet"]
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        let before = card.label
        app.buttons["reject"].tap()  // no question
        XCTAssertTrue(app.staticTexts["امروز دیگه نشونت نمی‌دیم"].waitForExistence(timeout: 5))
        XCTAssertNotEqual(card.label, before)
        shot(app, "reject-couplet-toast")
        app.buttons["toastUndo"].tap()
        let back = NSPredicate(format: "label == %@", before)
        expectation(for: back, evaluatedWith: card)
        waitForExpectations(timeout: 10)
    }

    // MARK: The face

    @MainActor func testLeavingAChangedFaceAsksAndAnUnchangedOneDoesNot() {
        let app = launch(["-beytRoute", "avatar"])
        XCTAssertTrue(app.buttons["avatarSave"].waitForExistence(timeout: 10))
        app.buttons["back"].tap()  // nothing changed: leaves at once
        XCTAssertTrue(waitForDisappearance(of: app.buttons["avatarSave"]))

        let again = launch(["-beytRoute", "avatar"])
        XCTAssertTrue(again.buttons["avatarPart-hair"].waitForExistence(timeout: 10))
        again.buttons["avatarPart-hair"].tap()
        again.buttons["avatarItem-lapis"].tap()
        again.buttons["back"].tap()
        let title = again.staticTexts["avatarDiscardTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertEqual(title.label, "چهره‌ات ذخیره نشده. ولش کنی؟")
        XCTAssertEqual(again.buttons["avatarDiscardCancel"].label, "بمون")
        XCTAssertEqual(again.buttons["avatarDiscardConfirm"].label, "ول کن")
        assertSheetFits(again, title: title, lastButton: again.buttons["avatarDiscardConfirm"])
        shot(again, "avatar-discard")
        again.buttons["avatarDiscardCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(again.buttons["avatarSave"].exists)

        again.buttons["back"].tap()
        again.buttons["avatarDiscardConfirm"].tap()
        XCTAssertTrue(waitForDisappearance(of: again.buttons["avatarSave"]))
    }

    // MARK: The username

    @MainActor func testTheUsernameHintIsOneLineThatSaysItHoldsForThirtyDays() {
        let app = launch(["-beytRoute", "settings"], signedIn: true)
        let row = app.buttons["settingsUsername"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        let hint = element(app, "usernameHint")
        XCTAssertTrue(hint.waitForExistence(timeout: 10))
        XCTAssertTrue(hint.label.hasSuffix("تا ۳۰ روز نمی‌شه عوضش کرد."), hint.label)
        XCTAssertFalse(element(app, "usernameLockNote").exists, "no second line at the bottom")
        shot(app, "username-lock-note")
    }

    // MARK: The face and the edge swipe

    @MainActor func testTheEdgeSwipeBackLeavesAnUnchangedFaceButNotAChangedOne() {
        let plain = launch(["-beytRoute", "avatar"])
        XCTAssertTrue(plain.buttons["avatarSave"].waitForExistence(timeout: 10))
        edgeSwipeBack(plain)
        XCTAssertTrue(waitForDisappearance(of: plain.buttons["avatarSave"]), "nothing to lose: the swipe goes back")
        plain.terminate()

        let app = launch(["-beytRoute", "avatar"])
        XCTAssertTrue(app.buttons["avatarPart-hair"].waitForExistence(timeout: 10))
        app.buttons["avatarPart-hair"].tap()
        app.buttons["avatarItem-lapis"].tap()
        edgeSwipeBack(app)
        sleep(2)
        XCTAssertTrue(app.buttons["avatarSave"].exists, "the swipe did not leave: the question is the way out")
    }

    @MainActor private func edgeSwipeBack(_ app: XCUIApplication) {
        // In right-to-left the back swipe starts at the right edge.
        let window = app.windows.firstMatch
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: 0.5))
            .press(forDuration: 0.1, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5)))
    }
}
