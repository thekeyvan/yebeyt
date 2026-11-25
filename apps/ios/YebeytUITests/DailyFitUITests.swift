import XCTest

/// معمای امروز fits the screen at the default text size on every phone, the small iPhone SE (375×667) included: the
/// title row is under the status bar, not in it, and the bottom buttons are fully on screen. At a larger text size the
/// content scrolls (the header and the buttons stay) instead of being cut off.
final class DailyFitUITests: XCTestCase {
    /// `-beytToday 2027-12-17` is a couplet that takes four lines on an iPhone SE: the worst case to fit.
    @MainActor private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytRoute", "daily", "-beytToday", "2027-12-17"] + extra
        app.launch()
        XCTAssertTrue(app.buttons["submit"].waitForExistence(timeout: 10))
        waitUntilSettled(app.buttons["gameClose"])
        return app
    }

    /// The game rises over the tabs when it opens: waits until the element has stopped moving and can be tapped.
    private func waitUntilSettled(_ element: XCUIElement, timeout: TimeInterval = 8) {
        let deadline = Date().addingTimeInterval(timeout)
        var last = CGRect.null
        while Date() < deadline {
            let frame = element.frame
            if element.isHittable, frame == last { return }
            last = frame
            Thread.sleep(forTimeInterval: 0.25)
        }
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
        let app = launch()
        let keys = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'key-'"))
        let grey = keys.matching(NSPredicate(format: "value == 'تو کلمه نیست'"))
        // Type the letters in the order of the keyboard and submit until a try shows a letter that is not in the word.
        var next = 0
        for _ in 0..<2 where grey.count == 0 {
            while !app.buttons["submit"].isEnabled, next < keys.count {
                keys.element(boundBy: next).tap()
                next += 1
            }
            app.buttons["submit"].tap()
            _ = grey.firstMatch.waitForExistence(timeout: 3)
        }
        XCTAssertGreaterThan(grey.count, 0, "a key reads «تو کلمه نیست»")
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
