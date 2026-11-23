import XCTest

final class TabBarUITests: XCTestCase {
    /// The raised «بازی» circle (56pt) sticks out 18pt above the bar. A tap near its top must select the
    /// tab; taps clearly outside it (above it, or in the empty space beside it) must not. iOS adds about
    /// 14pt of touch slop around a button, so the negative points are further out than that.
    @MainActor func testRaisedGamesButtonIsTappableAboveTheBar() {
        let app = XCUIApplication()
        app.launch()
        let bar = app.otherElements["تب‌ها"]  // its frame includes the circle, so minY is the circle's top
        XCTAssertTrue(bar.waitForExistence(timeout: 5))
        let games = app.buttons["بازی"]
        let home = app.buttons["خونه"]
        let screen = app.coordinate(withNormalizedOffset: .zero)
        let circleTop = bar.frame.minY
        let circleMidX = games.frame.midX

        func tap(dx: CGFloat, dy: CGFloat) -> Bool {
            home.tap()  // start from another tab: «بازی» stays selected once tapped
            screen.withOffset(CGVector(dx: circleMidX + dx, dy: circleTop + dy)).tap()
            return games.isSelected
        }

        XCTAssertTrue(tap(dx: 0, dy: 6), "a tap 6pt below the top of the raised circle did not select the tab")
        XCTAssertFalse(tap(dx: 0, dy: -20), "a tap above the circle selected the tab")
        XCTAssertFalse(tap(dx: -36, dy: 6), "a tap beside the circle selected the tab")
        XCTAssertFalse(tap(dx: 36, dy: 6), "a tap beside the circle selected the tab")
    }
}
