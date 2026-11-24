import XCTest

/// Every bottom sheet closes with a drag down, like a normal iOS sheet, and springs back when the drag is short.
/// (docs/yebeyt-2.md, «Motion»: the drag-dismiss rule.)
final class SheetDragUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: the fake sign-in and the fake server answer on the phone.
        app.launchArguments = ["-beytFresh", "1", "-beytToday", "2026-11-23", "-beytAPI", "http://127.0.0.1:9", "-beytStub", "1"] + arguments
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

    /// A drag of the finger down from `handle` (a point inside the sheet, near its top) by `distance` points.
    @MainActor private func drag(_ app: XCUIApplication, from handle: XCUIElement, down distance: CGFloat, fast: Bool = true) {
        let start = handle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let end = start.withOffset(CGVector(dx: 0, dy: distance))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: fast ? .fast : .slow, thenHoldForDuration: 0)
    }

    // MARK: Native sheets

    @MainActor func testTheAccountGateClosesWithADragDown() {
        let app = launch(["-beytGate", "likes"])
        let title = app.staticTexts["gateTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        drag(app, from: title, down: 500)
        XCTAssertTrue(waitForDisappearance(of: title))
    }

    @MainActor func testTheSharedDivanSheetClosesWithADragDown() {
        let app = launch(["-beytSignedIn", "1", "-beytRoute", "chat:sara.ghazal", "-beytDivanSheet", "1"])
        let title = app.staticTexts["به دیوان مشترک"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        drag(app, from: title, down: 700)
        XCTAssertTrue(waitForDisappearance(of: title))
    }

    @MainActor func testTheLeaveQuestionClosesWithADragDown() {
        let app = launch(["-beytRoute", "jigsaw"])
        app.buttons["gameClose"].tap()
        let title = app.staticTexts["leaveGameTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        drag(app, from: title, down: 500)
        XCTAssertTrue(waitForDisappearance(of: title))
    }

    @MainActor func testAShortDragOnANativeSheetSpringsBack() {
        let app = launch(["-beytGate", "likes"])
        let title = app.staticTexts["gateTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        let before = title.frame.minY
        drag(app, from: title, down: 40, fast: false)
        sleep(1)
        XCTAssertTrue(title.exists)
        XCTAssertEqual(title.frame.minY, before, accuracy: 4)
    }

    @MainActor func testTheFeedbackChoicesCloseWithADragDown() {
        let app = launch(["-beytFeedback", "shake"])
        let title = app.staticTexts["می‌خوای چیزی بگی؟"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        drag(app, from: title, down: 500)
        XCTAssertTrue(waitForDisappearance(of: title))
    }

    @MainActor func testTheTextSheetOfTheReaderClosesWithADragDown() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3", "-beytSheet", "text"])
        let chip = app.buttons["نستعلیق"]
        XCTAssertTrue(chip.waitForExistence(timeout: 10))
        let title = app.staticTexts["متن"]
        drag(app, from: title, down: 500)
        XCTAssertTrue(waitForDisappearance(of: chip))
    }

    @MainActor func testATapOutsideTheReadersTextSheetClosesIt() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3", "-beytSheet", "text"])
        let chip = app.buttons["نستعلیق"]
        XCTAssertTrue(chip.waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)).tap()
        XCTAssertTrue(waitForDisappearance(of: chip))
        XCTAssertTrue(app.staticTexts["readerTitle"].exists, "the reader is still open")
    }

    // MARK: The answer sheet (custom): a drag down is «بیت بعدی»

    @MainActor func testTheAnswerSheetClosesWithADragDownLikeTheNextButton() {
        let app = launch(["-beytRoute", "jigsaw-result"])
        let verdict = app.staticTexts["verdict"]
        XCTAssertTrue(verdict.waitForExistence(timeout: 10))
        drag(app, from: verdict, down: 300)
        XCTAssertTrue(waitForDisappearance(of: verdict))
    }

    @MainActor func testAShortDragOnTheAnswerSheetSpringsBack() {
        let app = launch(["-beytRoute", "jigsaw-result"])
        let verdict = app.staticTexts["verdict"]
        XCTAssertTrue(verdict.waitForExistence(timeout: 10))
        sleep(1)
        let before = verdict.frame.minY
        drag(app, from: verdict, down: 40, fast: false)
        sleep(1)
        XCTAssertTrue(verdict.exists, "a short drag does not close it")
        XCTAssertEqual(verdict.frame.minY, before, accuracy: 4, "it springs back")
    }
}
