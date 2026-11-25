import XCTest

/// The reader and a game rise from the bottom as one layer (`CoverLayer`) and go back down; the in-page tabs swap their
/// page. (docs/yebeyt-2.md, «Motion».)
final class CoverUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1"] + arguments
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    /// The cover is up and settled: it has stopped moving, and reaches from the top of the screen to (at least) its bottom
    /// edge. Its frame is the union of everything in it, so it also holds the paper it keeps under the bottom edge.
    @MainActor private func isFullyOnScreen(_ cover: XCUIElement, in app: XCUIApplication, timeout: TimeInterval = 8) -> Bool {
        let screen = app.windows.firstMatch.frame
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            let frame = cover.frame
            if cover.exists, frame.minX >= -1, frame.maxX <= screen.maxX + 1, frame.minY <= 2, frame.minY >= -2, frame.maxY >= screen.maxY - 2 {
                Thread.sleep(forTimeInterval: 0.3)
                if cover.exists, abs(cover.frame.minY - frame.minY) < 0.5, abs(cover.frame.maxY - frame.maxY) < 0.5 { return true }
            }
            Thread.sleep(forTimeInterval: 0.1)
        }
        return false
    }

    @MainActor private func waitForDisappearance(of element: XCUIElement, timeout: TimeInterval = 8) -> Bool {
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element)
        return XCTWaiter().wait(for: [gone], timeout: timeout) == .completed
    }

    // MARK: The reader

    @MainActor func testTheReaderRisesFullyOnScreenAndGoesDownWhenClosed() {
        let app = launch(["-beytRoute", "section:/hafez/ghazal"])
        let row = app.buttons["poem-1"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertFalse(element(app, "readerCover").exists)
        row.tap()
        let cover = element(app, "readerCover")
        XCTAssertTrue(cover.waitForExistence(timeout: 10))
        XCTAssertTrue(isFullyOnScreen(cover, in: app), "the reader fills the screen: \(cover.frame)")
        app.buttons["بستن"].tap()
        XCTAssertTrue(waitForDisappearance(of: cover), "the reader is gone after it is closed")
        XCTAssertTrue(app.buttons["poem-1"].waitForExistence(timeout: 5))
    }

    @MainActor func testADragDownOnTheReadersHeaderClosesIt() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3"])
        let cover = element(app, "readerCover")
        XCTAssertTrue(isFullyOnScreen(cover, in: app))
        let title = app.staticTexts["readerTitle"]
        let start = title.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: 500)), withVelocity: .fast, thenHoldForDuration: 0)
        XCTAssertTrue(waitForDisappearance(of: cover))
    }

    @MainActor func testAShortDragOnTheReadersHeaderSpringsBack() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3"])
        let cover = element(app, "readerCover")
        XCTAssertTrue(isFullyOnScreen(cover, in: app))
        let title = app.staticTexts["readerTitle"]
        let start = title.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: 60)), withVelocity: .slow, thenHoldForDuration: 0)
        XCTAssertTrue(isFullyOnScreen(cover, in: app), "it springs back")
    }

    /// A slow drag keeps the sheet under the finger: 55% of the height closes it (a slow release is not a flick).
    @MainActor func testASlowDragPastAThirdOfTheReaderClosesIt() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3"])
        let cover = element(app, "readerCover")
        XCTAssertTrue(isFullyOnScreen(cover, in: app))
        let start = app.staticTexts["readerTitle"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let distance = app.windows.firstMatch.frame.height * 0.55
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: distance)), withVelocity: .slow, thenHoldForDuration: 0)
        XCTAssertTrue(waitForDisappearance(of: cover), "a slow drag of 55% closes the reader")
    }

    @MainActor func testASlowDragUnderAThirdOfTheReaderSpringsBack() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3"])
        let cover = element(app, "readerCover")
        XCTAssertTrue(isFullyOnScreen(cover, in: app))
        let start = app.staticTexts["readerTitle"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let distance = app.windows.firstMatch.frame.height * 0.2
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: distance)), withVelocity: .slow, thenHoldForDuration: 0)
        XCTAssertTrue(isFullyOnScreen(cover, in: app), "a slow drag of 20% springs back")
    }

    @MainActor func testADragDownInTheReadersContentDoesNotCloseIt() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3", "-beytCouplet", "1"])
        let cover = element(app, "readerCover")
        XCTAssertTrue(isFullyOnScreen(cover, in: app))
        XCTAssertTrue(app.otherElements["بیت ۲ از ۹"].waitForExistence(timeout: 5))
        app.swipeDown()  // back to the first couplet: the page pages, the sheet stays
        XCTAssertTrue(app.otherElements["بیت ۱ از ۹"].waitForExistence(timeout: 5))
        XCTAssertTrue(isFullyOnScreen(cover, in: app))
    }

    // MARK: A game

    @MainActor func testAGameRisesFullyOnScreenOverTheTabsAndGoesDownWhenLeft() {
        let app = launch(["-beytTab", "games"])
        let card = app.buttons["game-poet"]
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        let bar = app.otherElements["tabBar"]
        XCTAssertTrue(bar.isHittable)
        XCTAssertFalse(element(app, "gameHost").exists)
        card.tap()
        let host = element(app, "gameHost")
        XCTAssertTrue(host.waitForExistence(timeout: 10))
        XCTAssertTrue(isFullyOnScreen(host, in: app), "the game fills the screen: \(host.frame)")
        XCTAssertFalse(bar.exists && bar.isHittable, "the tab bar is out of reach while the game is up")

        app.buttons["gameClose"].tap()
        let confirm = app.buttons["leaveGameConfirm"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        XCTAssertTrue(waitForDisappearance(of: host), "the game is gone after «برو بیرون»")
        XCTAssertTrue(waitForDisappearance(of: confirm), "and so is the question")
        XCTAssertTrue(bar.waitForExistence(timeout: 5))
        XCTAssertTrue(bar.isHittable)
    }

    /// Opening and closing a game that closes without asking, twice in a row: the tab bar comes back each time and the
    /// second game is all the way up (the covering state of the first must not leak into the second).
    @MainActor func testAGameOpenedRightAfterAnotherWasClosedIsUpAndTheTabBarIsBackBetween() {
        let app = launch(["-beytTab", "games"])
        let open = app.buttons["dailyOpen"]
        XCTAssertTrue(open.waitForExistence(timeout: 10))
        let bar = app.otherElements["tabBar"]
        for _ in 0..<2 {
            open.tap()
            let host = element(app, "gameHost")
            XCTAssertTrue(host.waitForExistence(timeout: 10))
            XCTAssertTrue(isFullyOnScreen(host, in: app))
            XCTAssertFalse(bar.exists && bar.isHittable)
            app.buttons["gameClose"].tap()
            XCTAssertTrue(waitForDisappearance(of: host))
            XCTAssertTrue(bar.waitForExistence(timeout: 5))
            XCTAssertTrue(bar.isHittable)
        }
    }

    @MainActor func testAGameOpenedAtLaunchIsAlreadyUp() {
        let app = launch(["-beytRoute", "poet-game"])
        let host = element(app, "gameHost")
        XCTAssertTrue(host.waitForExistence(timeout: 10))
        XCTAssertTrue(isFullyOnScreen(host, in: app))
        XCTAssertFalse(app.otherElements["tabBar"].exists)
    }

    // MARK: Tabs inside a page

    @MainActor func testSwitchingASectionsSortReplacesTheListAndMovesTheHighlight() {
        let app = launch(["-beytRoute", "section:/hafez/ghazal"])
        XCTAssertTrue(app.buttons["poem-1"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["sort-0"].isSelected)
        app.buttons["sort-1"].tap()
        XCTAssertTrue(app.buttons["sort-1"].isSelected)
        XCTAssertFalse(app.buttons["sort-0"].isSelected)
        // The old page has gone once the new one is in: each poem is there once.
        let predicate = NSPredicate(format: "identifier == 'poem-1'")
        let once = XCTNSPredicateExpectation(predicate: NSPredicate(format: "count == 1"), object: app.buttons.matching(predicate))
        XCTAssertEqual(XCTWaiter().wait(for: [once], timeout: 8), .completed)
        app.buttons["sort-0"].tap()
        XCTAssertTrue(app.buttons["sort-0"].isSelected)
        XCTAssertTrue(app.buttons["poem-1"].waitForExistence(timeout: 5))
    }

    @MainActor func testTheBugFormsTabsMoveTheirHighlight() {
        let app = launch(["-beytFeedback", "bug"])
        let first = app.buttons["feedbackFrequency-0"]
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        let second = app.buttons["feedbackFrequency-1"]
        second.tap()
        XCTAssertTrue(second.isSelected)
        XCTAssertFalse(first.isSelected)
    }
}
