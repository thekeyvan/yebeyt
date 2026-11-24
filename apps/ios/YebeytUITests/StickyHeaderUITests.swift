import XCTest

/// The top navigation (back, close) is pinned: scrolling to the end of the content leaves it where it was.
final class StickyHeaderUITests: XCTestCase {
    /// The top safe area of the iPhone 17 (62 pt) plus the header's own height; anything lower has scrolled away.
    private let headerBottom: CGFloat = 130

    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1"] + arguments
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    /// Scrolls the content up as far as it goes, then checks the button is still where it was, at the top, big enough, and
    /// that a tap on it works (`leaves` says what followed). It taps instead of asking `isHittable`: the rows scrolled
    /// under the header still sit in the accessibility tree and make the button look covered.
    @MainActor private func assertPinned(
        _ app: XCUIApplication, button: XCUIElement, content: XCUIElement, leaves: () -> Bool,
        file: StaticString = #filePath, line: UInt = #line
    ) {
        XCTAssertTrue(button.waitForExistence(timeout: 10), "the button is there before scrolling", file: file, line: line)
        XCTAssertTrue(content.waitForExistence(timeout: 10), file: file, line: line)
        let (buttonBefore, contentBefore) = (button.frame.minY, content.frame.minY)
        for _ in 0..<4 { app.swipeUp(velocity: .fast) }
        // a long list recycles the rows that went off the top
        if content.exists { XCTAssertLessThan(content.frame.minY, contentBefore - 1, "the content scrolled", file: file, line: line) }
        XCTAssertEqual(button.frame.minY, buttonBefore, accuracy: 1, "the button did not move", file: file, line: line)
        XCTAssertLessThan(button.frame.minY, headerBottom, "the button is at the top", file: file, line: line)
        XCTAssertGreaterThanOrEqual(button.frame.height, 44, file: file, line: line)
        button.tap()
        XCTAssertTrue(leaves(), "tapping the button after scrolling works", file: file, line: line)
    }

    @MainActor func testASectionKeepsItsBackButtonWhileTheListScrolls() {
        let app = launch(["-beytRoute", "section:/hafez/ghazal"])
        assertPinned(app, button: app.buttons["back"], content: app.buttons["poem-1"],
                     leaves: { app.buttons["section-24"].waitForExistence(timeout: 5) })
    }

    @MainActor func testABookPageKeepsItsBackButtonWhileItScrolls() {
        let app = launch(["-beytRoute", "book:/hafez"])
        assertPinned(app, button: app.buttons["back"], content: app.buttons["primary"],
                     leaves: { app.buttons["book-9"].waitForExistence(timeout: 5) })
    }

    @MainActor func testASettingsSubPageKeepsItsBackButtonWhileItScrolls() {
        let app = launch(["-beytRoute", "settings"])
        let licenses = app.buttons["licenses"]
        XCTAssertTrue(licenses.waitForExistence(timeout: 10))
        licenses.tap()
        assertPinned(app, button: app.buttons["back"], content: app.staticTexts["قلم‌ها"],
                     leaves: { licenses.waitForExistence(timeout: 5) })
    }

    @MainActor func testTheReaderKeepsItsCloseButtonInTheWholePoemList() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3", "-beytMode", "scroll"])
        assertPinned(app, button: app.buttons["بستن"], content: element(app, "couplet-0"),
                     leaves: { app.staticTexts["readerTitle"].waitForNonExistence(timeout: 5) })
    }

    @MainActor func testAGameKeepsItsCloseButtonWhileItScrolls() {
        // a big text size makes the question taller than the screen
        let app = launch(["-beytRoute", "poet-game", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXL"])
        assertPinned(app, button: app.buttons["gameClose"], content: app.staticTexts["score"],
                     leaves: { app.buttons["leaveGameConfirm"].waitForExistence(timeout: 5) })
    }
}
