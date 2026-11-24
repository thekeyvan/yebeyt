import XCTest

final class TabBarUITests: XCTestCase {
    /// The raised «بازی» circle (56pt) sticks out 18pt above the bar. A tap near its top must select the
    /// tab; taps clearly outside it (above it, or in the empty space beside it) must not. iOS adds about
    /// 14pt of touch slop around a button, so the negative points are further out than that.
    @MainActor func testRaisedGamesButtonIsTappableAboveTheBar() {
        let app = XCUIApplication()
        app.launch()
        let bar = app.otherElements["tabBar"]  // its frame includes the circle, so minY is the circle's top
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

    // MARK: the last thing on a page ends above the bar

    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytToday", "2026-11-23"] + arguments
        app.launch()
        return app
    }

    /// Scrolls the page to its end (until the lowest matching element stops moving) and checks that it ends above the bar.
    @MainActor private func assertEndsAboveTheBar(_ app: XCUIApplication, items prefix: String, file: StaticString = #filePath, line: UInt = #line) {
        let items = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix))
        XCTAssertTrue(items.firstMatch.waitForExistence(timeout: 10), file: file, line: line)
        let bar = app.otherElements["tabBar"]
        XCTAssertTrue(bar.exists, file: file, line: line)
        func lowest() -> CGFloat { items.allElementsBoundByIndex.map(\.frame.maxY).max() ?? 0 }
        var last = lowest()
        var steady = 0
        for _ in 0..<40 where steady < 2 {
            app.scrollViews.firstMatch.swipeUp(velocity: .fast)
            let now = lowest()
            steady = now == last ? steady + 1 : 0
            last = now
        }
        XCTAssertLessThanOrEqual(last, bar.frame.minY, "the last «\(prefix)» item is under the tab bar", file: file, line: line)
    }

    @MainActor func testTheLibraryEndsAboveTheBar() {
        assertEndsAboveTheBar(launch(["-beytRoute", "library"]), items: "book-")
    }

    @MainActor func testTheGamesTabEndsAboveTheBar() {
        assertEndsAboveTheBar(launch(["-beytTab", "games"]), items: "game-")
    }

    @MainActor func testTheGamesCatalogEndsAboveTheBar() {
        assertEndsAboveTheBar(launch(["-beytRoute", "games-catalog"]), items: "catalog-")
    }
}
