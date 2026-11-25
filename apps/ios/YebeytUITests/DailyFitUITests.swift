import XCTest

/// معمای امروز fits the screen at the default text size on every phone, the small iPhone SE (375×667) included: the
/// title row is under the status bar, not in it, and the bottom buttons are fully on screen. At a larger text size the
/// content scrolls (the header and the buttons stay) instead of being cut off.
final class DailyFitUITests: XCTestCase {
    @MainActor private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytRoute", "daily"] + extra
        app.launch()
        XCTAssertTrue(app.buttons["submit"].waitForExistence(timeout: 10))
        return app
    }

    /// The close button and the bottom buttons are on screen, and the title row is not under the status bar.
    @MainActor private func assertFits(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let screen = app.windows.firstMatch.frame
        // The status bar is not in the accessibility tree: 20 pt on the home-button phones, at least 44 on the others.
        let statusBar: CGFloat = screen.height <= 667 ? 20 : 44
        let close = app.buttons["gameClose"]
        XCTAssertGreaterThanOrEqual(close.frame.minY, statusBar, "the close button is below the status bar (\(statusBar))", file: file, line: line)
        XCTAssertTrue(close.isHittable, "the close button can be tapped", file: file, line: line)
        for identifier in ["submit", "hint"] {
            let button = app.buttons[identifier]
            XCTAssertTrue(button.exists, identifier, file: file, line: line)
            XCTAssertLessThanOrEqual(button.frame.maxY, screen.maxY, "\(identifier) ends on the screen: \(button.frame)", file: file, line: line)
            XCTAssertGreaterThanOrEqual(button.frame.minX, 0, file: file, line: line)
            XCTAssertLessThanOrEqual(button.frame.maxX, screen.maxX, file: file, line: line)
            XCTAssertTrue(button.isHittable, "\(identifier) can be tapped", file: file, line: line)
        }
    }

    @MainActor func testTheDailyPuzzleFitsTheScreenAtTheDefaultTextSize() {
        let app = launch()
        assertFits(app)
        // All of it is there without scrolling: the grid's last row, the keyboard's «پاک کن», the host that holds it all.
        XCTAssertTrue(app.buttons["erase"].isHittable, "the keyboard is whole")
        let submit = app.buttons["submit"].frame
        XCTAssertLessThanOrEqual(app.otherElements["try3"].frame.maxY, submit.minY, "the grid is above the buttons")
        let erase = app.buttons["erase"].frame
        XCTAssertLessThanOrEqual(erase.maxY, submit.minY, "the keyboard is above the buttons: \(erase) \(submit)")
        XCTAssertGreaterThanOrEqual(app.descendants(matching: .any)["dailyCouplet"].frame.minY, app.buttons["gameClose"].frame.maxY, "the couplet is under the header")
        // nothing to scroll: a swipe moves nothing
        app.swipeUp()
        XCTAssertEqual(app.buttons["erase"].frame, erase, "the content did not move")
        let host = app.descendants(matching: .any)["gameHost"]
        XCTAssertGreaterThanOrEqual(host.frame.minY, -1, "nothing is pushed above the screen: \(host.frame)")
    }

    @MainActor func testTheDailyPuzzleStillFitsAfterAKeyGoesGrey() {
        let app = launch(["-beytPlay", "2"])
        assertFits(app)
        XCTAssertTrue(app.buttons["erase"].isHittable)
    }

    @MainActor func testTheDailyPuzzleScrollsAtALargeTextSizeAndKeepsItsHeaderAndButtons() {
        let app = launch(["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXL"])
        assertFits(app)
        let erase = app.buttons["erase"]
        XCTAssertTrue(erase.waitForExistence(timeout: 5))
        for _ in 0..<4 where !erase.isHittable { app.swipeUp() }
        XCTAssertTrue(erase.isHittable, "the end of the keyboard can be scrolled to")
        assertFits(app)
    }
}
