import XCTest

final class TabBarUITests: XCTestCase {
    /// The raised «بازی» circle sticks out 18pt above the bar; a tap on its top must select the tab,
    /// and a tap on the empty corner beside it must not.
    @MainActor func testRaisedGamesButtonIsTappableAboveTheBar() {
        let app = XCUIApplication()
        app.launch()
        let games = app.buttons["بازی"]
        XCTAssertTrue(games.waitForExistence(timeout: 5))
        XCTAssertFalse(games.isSelected)

        let screen = app.coordinate(withNormalizedOffset: .zero)
        let barTop = app.frame.maxY - 18 - 70
        let aboveBar = barTop - 12  // 6pt below the circle top edge (circle top = bar top - 18)
        screen.withOffset(CGVector(dx: app.frame.midX - 36, dy: aboveBar)).tap()
        XCTAssertFalse(games.isSelected, "the empty corner beside the circle selected the tab")
        screen.withOffset(CGVector(dx: app.frame.midX, dy: aboveBar)).tap()
        XCTAssertTrue(games.isSelected, "a tap on the top of the raised circle did not select the tab")
    }
}
