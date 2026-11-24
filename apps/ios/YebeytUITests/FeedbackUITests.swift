import XCTest

final class FeedbackUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: the fake server answers on the phone.
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9"] + arguments
        app.launch()
        return app
    }

    @MainActor private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    @MainActor private func waitForDisappearance(of element: XCUIElement, timeout: TimeInterval = 8) -> Bool {
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element)
        return XCTWaiter().wait(for: [gone], timeout: timeout) == .completed
    }

    @MainActor private func write(_ text: String, in app: XCUIApplication) {
        let field = element(app, "feedbackText")
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText(text)
    }

    @MainActor func testShakeOpensTheChoicesAndABugReportIsSentWithAThankYou() {
        let app = launch(["-beytFeedback", "shake"])
        let bug = app.buttons["feedbackType-bug"]
        XCTAssertTrue(bug.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["feedbackType-idea"].exists && app.buttons["feedbackType-game"].exists
            && app.buttons["feedbackType-liked"].exists && app.buttons["feedbackType-annoyed"].exists)
        XCTAssertTrue(element(app, "feedbackShakeNote").exists)
        bug.tap()

        let send = app.buttons["feedbackSend"]
        XCTAssertTrue(send.waitForExistence(timeout: 10))
        XCTAssertFalse(send.isEnabled)  // waits for the text
        write("the play button did nothing", in: app)
        XCTAssertTrue(send.isEnabled)
        app.buttons["feedbackTechnicalToggle"].tap()
        XCTAssertTrue(element(app, "feedbackTechnicalRows").waitForExistence(timeout: 5))
        send.tap()

        let toast = element(app, "feedbackToast")
        XCTAssertTrue(toast.waitForExistence(timeout: 10))
        XCTAssertEqual(toast.label, "رسید، ممنون!")
        XCTAssertTrue(waitForDisappearance(of: send))  // the sheet closed
        XCTAssertTrue(app.buttons["dailyCouplet"].waitForExistence(timeout: 5))
    }

    @MainActor func testAGameSuggestionIsSentAndNeedsTheHowText() {
        let app = launch(["-beytFeedback", "game"])
        let send = app.buttons["feedbackSend"]
        XCTAssertTrue(send.waitForExistence(timeout: 10))
        XCTAssertFalse(send.isEnabled)
        XCTAssertTrue(element(app, "feedbackAccountNote").exists)
        XCTAssertFalse(element(app, "feedbackScreenshotSwitch").exists)  // a game idea takes no screenshot
        app.buttons["feedbackPlayers-2"].tap()
        write("a missing word", in: app)
        XCTAssertTrue(send.isEnabled)
        send.tap()
        XCTAssertTrue(element(app, "feedbackToast").waitForExistence(timeout: 10))
    }

    @MainActor func testTheTextTypesHaveTheirScreenshotSwitchesAsTheTableSays() {
        let annoyed = launch(["-beytFeedback", "annoyed"])
        XCTAssertTrue(element(annoyed, "feedbackScreenshotSwitch").waitForExistence(timeout: 10))
        XCTAssertEqual(element(annoyed, "feedbackScreenshotSwitch").value as? String, "1")
        XCTAssertFalse(element(annoyed, "feedbackTechnicalToggle").exists)  // only a bug has technical info
        annoyed.terminate()

        let idea = launch(["-beytFeedback", "idea"])
        XCTAssertTrue(element(idea, "feedbackScreenshotSwitch").waitForExistence(timeout: 10))
        XCTAssertEqual(element(idea, "feedbackScreenshotSwitch").value as? String, "0")
        idea.terminate()

        let liked = launch(["-beytFeedback", "liked"])
        XCTAssertTrue(element(liked, "feedbackText").waitForExistence(timeout: 10))
        XCTAssertFalse(element(liked, "feedbackScreenshotSwitch").exists)
    }

    @MainActor func testOfflineKeepsTheDraftAndTheButton() {
        let app = launch(["-beytFeedback", "idea", "-beytFeedbackFails", "offline"])
        let send = app.buttons["feedbackSend"]
        XCTAssertTrue(send.waitForExistence(timeout: 10))
        write("an idea", in: app)
        send.tap()
        let failure = element(app, "feedbackFailure")
        XCTAssertTrue(failure.waitForExistence(timeout: 10))
        XCTAssertEqual(failure.label, "الان نرسید، وقتی اینترنت اومد دوباره بفرست")
        XCTAssertTrue(send.isEnabled)
        XCTAssertFalse(element(app, "feedbackToast").exists)
    }

    @MainActor func testTooManyReportsAsksToSendLater() {
        let app = launch(["-beytFeedback", "liked", "-beytFeedbackFails", "rate"])
        let send = app.buttons["feedbackSend"]
        XCTAssertTrue(send.waitForExistence(timeout: 10))
        write("thanks", in: app)
        send.tap()
        let failure = element(app, "feedbackFailure")
        XCTAssertTrue(failure.waitForExistence(timeout: 10))
        XCTAssertEqual(failure.label, "یه کم بعد دوباره بفرست")
    }

    @MainActor func testTheEditorDrawsCoversAndUndoes() {
        let app = launch(["-beytFeedback", "bug"])
        let edit = app.buttons["feedbackEdit"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        let picture = element(app, "editorPicture")
        XCTAssertTrue(picture.waitForExistence(timeout: 5))
        let undo = app.buttons["editorUndo"]
        XCTAssertFalse(undo.isEnabled)
        let from = picture.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.3))
        from.press(forDuration: 0.1, thenDragTo: picture.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.4)))
        XCTAssertTrue(undo.isEnabled)
        app.buttons["editorTool-1"].tap()  // «بپوشون»
        from.press(forDuration: 0.1, thenDragTo: picture.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.6)))
        undo.tap()
        undo.tap()
        XCTAssertFalse(undo.isEnabled)
        app.buttons["editorDone"].tap()
        XCTAssertTrue(app.buttons["feedbackEdit"].waitForExistence(timeout: 5))
    }

    @MainActor func testSettingsHasTheFeedbackRowAndTheShakeSwitch() {
        let app = launch(["-beytRoute", "settings"])
        let shake = element(app, "settingsShake")
        XCTAssertTrue(shake.waitForExistence(timeout: 10))
        XCTAssertEqual(shake.value as? String, "1")  // on by default
        shake.tap()
        XCTAssertEqual(shake.value as? String, "0")
        shake.tap()
        app.buttons["settingsFeedback"].tap()
        XCTAssertTrue(app.buttons["feedbackType-bug"].waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "feedbackShakeNote").exists)
    }
}
