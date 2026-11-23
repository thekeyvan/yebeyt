import XCTest

final class ReaderUITests: XCTestCase {
    private let poem = ["-beytRoute", "poem:/hafez/ghazal/sh3"]

    @MainActor private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = poem + extra
        app.launch()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
        return app
    }

    private func headerFrames(_ app: XCUIApplication) -> [String: CGRect] {
        [
            "close": app.buttons["بستن"].frame,
            "title": app.staticTexts["readerTitle"].frame,
            "subtitle": app.staticTexts["readerSubtitle"].frame,
            "game": app.buttons["بازی با این غزل"].frame,
            "text": app.buttons["اندازه‌ی حروف"].frame,
            "toggle": app.otherElements["حالت خوندن"].frame,
        ]
    }

    /// The hard rule of the reader: switching modes must not move the header.
    @MainActor func testHeaderStaysPutWhenTheModeChanges() {
        let app = launch()
        let coupletMode = headerFrames(app)
        XCTAssertEqual(app.staticTexts["readerTitle"].label, "غزل ۳")
        XCTAssertEqual(app.staticTexts["readerSubtitle"].label, "حافظ · غزلیات")

        let rail = app.otherElements["بیت ۱ از ۹"]
        XCTAssertTrue(rail.exists)

        app.buttons["کل شعر"].tap()
        XCTAssertTrue(rail.waitForNonExistence(timeout: 5))
        assertSame(coupletMode, headerFrames(app))

        app.buttons["بیت به بیت"].tap()
        XCTAssertTrue(rail.waitForExistence(timeout: 5))
        assertSame(coupletMode, headerFrames(app))
    }

    /// The second couplet of the ghazal, on the couplet page or in the whole-poem list.
    private func secondCouplet(_ app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)["couplet-1"]
    }

    private func assertSame(_ before: [String: CGRect], _ after: [String: CGRect], file: StaticString = #filePath, line: UInt = #line) {
        for (name, frame) in before {
            let other = after[name]!
            XCTAssertFalse(frame.isEmpty, "\(name) was not found", file: file, line: line)
            XCTAssertEqual(frame.minX, other.minX, accuracy: 0.5, "\(name) moved", file: file, line: line)
            XCTAssertEqual(frame.minY, other.minY, accuracy: 0.5, "\(name) moved", file: file, line: line)
            XCTAssertEqual(frame.width, other.width, accuracy: 0.5, "\(name) resized", file: file, line: line)
            XCTAssertEqual(frame.height, other.height, accuracy: 0.5, "\(name) resized", file: file, line: line)
        }
    }

    @MainActor func testSwipingUpShowsTheNextCouplet() {
        let app = launch(["-beytCouplet", "1"])
        XCTAssertTrue(app.otherElements["بیت ۲ از ۹"].waitForExistence(timeout: 5))
        app.swipeUp()
        XCTAssertTrue(app.otherElements["بیت ۳ از ۹"].waitForExistence(timeout: 5))
    }

    @MainActor func testLongPressOnACoupletOpensTheHoldMenu() {
        let app = launch(["-beytCouplet", "1"])
        let couplet = secondCouplet(app)
        XCTAssertTrue(couplet.waitForExistence(timeout: 5))
        couplet.press(forDuration: 1.2)
        XCTAssertTrue(app.descendants(matching: .any)["کارهای این بیت"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["کپی متن"].exists)
        XCTAssertTrue(app.buttons["بازی با این بیت"].exists)
        XCTAssertTrue(app.buttons["معنی این بیت"].exists)
    }

    @MainActor func testLongPressInTheWholePoemOpensTheHoldMenuAndATapOutsideClosesIt() {
        let app = launch(["-beytMode", "scroll"])
        let couplet = secondCouplet(app)
        XCTAssertTrue(couplet.waitForExistence(timeout: 5))
        couplet.press(forDuration: 1.2)
        let menu = app.descendants(matching: .any)["کارهای این بیت"]
        XCTAssertTrue(menu.waitForExistence(timeout: 5))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).tap()
        XCTAssertTrue(menu.waitForNonExistence(timeout: 5))
    }

    @MainActor func testTappingACoupletInTheWholePoemOpensItInCoupletMode() {
        let app = launch(["-beytMode", "scroll"])
        let couplet = secondCouplet(app)
        XCTAssertTrue(couplet.waitForExistence(timeout: 5))
        couplet.tap()
        XCTAssertTrue(app.otherElements["بیت ۲ از ۹"].waitForExistence(timeout: 5))
    }

    @MainActor func testTheTextSheetOpensAndClosesWithTamam() {
        let app = launch()
        app.buttons["اندازه‌ی حروف"].tap()
        XCTAssertTrue(app.buttons["نستعلیق"].waitForExistence(timeout: 5))
        app.buttons["کاغذی"].tap()  // the chosen theme, so the test leaves the saved settings as they were
        app.buttons["تمام"].tap()
        XCTAssertTrue(app.buttons["نستعلیق"].waitForNonExistence(timeout: 5))
    }

    @MainActor func testTheCloseButtonLeavesTheReader() {
        let app = launch()
        app.buttons["بستن"].tap()
        XCTAssertTrue(app.otherElements["تب‌ها"].waitForExistence(timeout: 5))
    }
}
