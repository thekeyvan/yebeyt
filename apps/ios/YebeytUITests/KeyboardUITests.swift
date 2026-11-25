import XCTest

/// The keyboard in a chat: it closes by scrolling and by a tap outside the field, it closes when a couplet opens, and a shake
/// still opens the feedback sheet while it is up (the shake is delivered by the debug strip `-beytShakeButton 1`).
final class KeyboardUITests: XCTestCase {
    @MainActor private func launchChat(shake: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9", "-beytSignedIn", "1", "-beytRoute", "chat:sara.ghazal"]
            + (shake ? ["-beytShakeButton", "1"] : [])
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    @MainActor private func typeInComposer(_ app: XCUIApplication) -> XCUIElement {
        let composer = app.textFields["composer"]
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "coupletCard-m1").waitForExistence(timeout: 10))
        composer.tap()
        composer.typeText("salam")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        return composer
    }

    @MainActor private func waitForKeyboardToGo(_ app: XCUIApplication, timeout: TimeInterval = 5) -> Bool {
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch)
        return XCTWaiter().wait(for: [gone], timeout: timeout) == .completed
    }

    @MainActor func testATapOutsideTheFieldClosesTheKeyboardAndKeepsWhatWasTyped() {
        let app = launchChat()
        let composer = typeInComposer(app)
        element(app, "bubble-m3").tap()
        XCTAssertTrue(waitForKeyboardToGo(app))
        XCTAssertEqual(composer.value as? String, "salam")
    }

    @MainActor func testPullingTheMessagesDownClosesTheKeyboard() {
        let app = launchChat()
        _ = typeInComposer(app)
        let top = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
        top.press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.97)))  // the finger goes down into the keyboard
        XCTAssertTrue(waitForKeyboardToGo(app))
    }

    @MainActor func testTheSendButtonStillSendsWithTheKeyboardUp() {
        let app = launchChat()
        let composer = typeInComposer(app)
        app.buttons["sendMessage"].tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", "bubble-sent-")).firstMatch.waitForExistence(timeout: 10))
        XCTAssertFalse((composer.value as? String ?? "").contains("salam"))
    }

    @MainActor func testOpeningACoupletFromTheChatClosesTheKeyboard() {
        let app = launchChat()
        _ = typeInComposer(app)
        element(app, "coupletCard-m1").tap()
        XCTAssertTrue(element(app, "readerCover").waitForExistence(timeout: 10))
        XCTAssertTrue(waitForKeyboardToGo(app))
    }

    @MainActor func testAShakeWhileTypingClosesTheKeyboardAndOpensTheFeedbackSheet() {
        let app = launchChat(shake: true)
        _ = typeInComposer(app)
        element(app, "debugShake").tap()
        XCTAssertTrue(app.buttons["feedbackType-bug"].waitForExistence(timeout: 10))
        XCTAssertTrue(waitForKeyboardToGo(app))
    }

    @MainActor func testAShakeOverTheReaderOpenedFromTheChatOpensTheFeedbackSheet() {
        let app = launchChat(shake: true)
        _ = typeInComposer(app)
        element(app, "coupletCard-m1").tap()
        XCTAssertTrue(element(app, "readerCover").waitForExistence(timeout: 10))
        element(app, "debugShake").tap()
        XCTAssertTrue(app.buttons["feedbackType-bug"].waitForExistence(timeout: 10))
    }
}
