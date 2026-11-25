import XCTest

extension XCTestCase {
    /// A small question sheet is about as tall as its content: its top (a little above the title) is in the lower part of
    /// the screen, and the buttons end near the bottom edge instead of leaving a blank band.
    @MainActor func assertSheetFits(_ app: XCUIApplication, title: XCUIElement, lastButton: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        let screen = app.windows.firstMatch.frame.height
        let sheetTop = title.frame.minY - 50  // the grabber and the top padding
        XCTAssertLessThan(screen - sheetTop, screen * 0.4, "the sheet takes under 40% of the screen", file: file, line: line)
        XCTAssertLessThanOrEqual(lastButton.frame.maxY, screen, "the buttons are not cut off by the screen's edge", file: file, line: line)
        XCTAssertLessThan(screen - lastButton.frame.maxY, 90, "no empty band under the buttons", file: file, line: line)
    }
}
