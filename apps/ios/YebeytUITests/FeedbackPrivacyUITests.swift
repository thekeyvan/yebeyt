import XCTest

/// What a report must never carry: typed text and messages are blanked out of the screenshot and of a recording.
final class FeedbackPrivacyUITests: XCTestCase {
    @MainActor private func launchChat(_ extra: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9", "-beytSignedIn", "1", "-beytRoute", "chat:sara.ghazal"] + extra
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    /// The rects painted over the screenshot, from the thumbnail's debug value.
    private func redactedRects(_ app: XCUIApplication) -> [CGRect] {
        let value = element(app, "feedbackThumbnail").value as? String ?? ""
        return value.split(separator: ";").compactMap { part in
            let n = part.split(separator: ",").compactMap { Double($0) }
            return n.count == 4 ? CGRect(x: n[0], y: n[1], width: n[2], height: n[3]) : nil
        }
    }

    @MainActor private func shakeAndOpenTheForm(_ app: XCUIApplication) {
        element(app, "debugShake").tap()
        let bug = app.buttons["feedbackType-bug"]
        XCTAssertTrue(bug.waitForExistence(timeout: 10))
        bug.tap()
        XCTAssertTrue(element(app, "feedbackThumbnail").waitForExistence(timeout: 10))
    }

    @MainActor func testTheScreenshotOfAShakeWhileTypingCoversTheDraft() {
        let app = launchChat(["-beytShakeButton", "1"])
        let composer = app.textFields["composer"]
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        composer.tap()
        composer.typeText("a draft nobody should see")
        let field = composer.frame  // the keyboard is up: this is where the field is drawn
        shakeAndOpenTheForm(app)

        let rects = redactedRects(app)
        XCTAssertTrue(rects.contains { $0.contains(CGPoint(x: field.midX, y: field.midY)) }, "the draft is covered: \(rects) over \(field)")
    }

    @MainActor func testTheScreenshotOfAShakeCoversTheMessagesOnScreen() {
        let app = launchChat(["-beytShakeButton", "1"])
        let bubble = element(app, "bubble-m3")
        XCTAssertTrue(bubble.waitForExistence(timeout: 10))
        XCTAssertTrue(bubble.isHittable)
        let frame = bubble.frame
        shakeAndOpenTheForm(app)

        // The element is the bubble and its time line under it: the blank covers the bubble's whole width and top.
        let rects = redactedRects(app)
        XCTAssertTrue(
            rects.contains { abs($0.minX - frame.minX) <= 2 && abs($0.maxX - frame.maxX) <= 2 && abs($0.minY - frame.minY) <= 2 && $0.height >= 36 && $0.maxY <= frame.maxY + 2 },
            "the message is covered: \(rects) over \(frame)"
        )
    }

    @MainActor func testTheScreenshotOverTheReaderOpenedFromTheChatHasNoBlanks() {
        let app = launchChat(["-beytShakeButton", "1"])
        let composer = app.textFields["composer"]
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        composer.tap()
        composer.typeText("hi")
        element(app, "coupletCard-m1").tap()
        XCTAssertTrue(element(app, "readerCover").waitForExistence(timeout: 10))
        shakeAndOpenTheForm(app)
        XCTAssertEqual(redactedRects(app), [], "the chat under the reader is not in the picture")
    }

    @MainActor func testWhileRecordingTheMessagesAndTheFieldAreCovered() {
        let app = launchChat(["-beytFeedback", "bug", "-beytFakeRecorder", "1"])
        let record = app.buttons["feedbackRecord"]
        XCTAssertTrue(record.waitForExistence(timeout: 15))
        record.tap()
        XCTAssertTrue(element(app, "recordingPill").waitForExistence(timeout: 10))

        XCTAssertTrue(element(app, "feedbackCover").waitForExistence(timeout: 5), "the private views draw a cover")
        let bubble = element(app, "bubble-m3")
        XCTAssertTrue(bubble.waitForExistence(timeout: 5))
        XCTAssertEqual(bubble.label, "پنهان", "the message is not readable while recording")

        app.buttons["recordingStop"].tap()
        XCTAssertTrue(element(app, "feedbackRecorded").waitForExistence(timeout: 10))
        XCTAssertFalse(element(app, "feedbackCover").exists, "the covers go with the recording")
    }
}
