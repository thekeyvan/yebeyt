import XCTest

final class FriendsUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: the fake sign-in is answered on the phone, friends included.
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9", "-beytSignedIn", "1"] + arguments
        app.launch()
        return app
    }

    /// A label without the invisible direction marks that SwiftUI puts around a name or a number in right-to-left text.
    private func plain(_ text: String) -> String {
        text.filter { !("\u{2066}"..."\u{2069}").contains($0) }
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    @MainActor func testHomeLeadsToFindingAFriendAndFollowingThem() {
        let app = launch(["-beytTab", "home"])
        let find = app.buttons["پیدا کردن دوست"]
        XCTAssertTrue(find.waitForExistence(timeout: 10))
        find.tap()

        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText("ki")

        let follow = app.buttons["follow-kian_k"]
        XCTAssertTrue(follow.waitForExistence(timeout: 10))
        XCTAssertEqual(follow.label, "دنبال کن")
        follow.tap()
        let following = NSPredicate(format: "label == %@", "دنبالش می‌کنی")
        expectation(for: following, evaluatedWith: follow)
        waitForExpectations(timeout: 10)
    }

    @MainActor func testTheLeaderboardHasThreeTabs() {
        let app = launch(["-beytRoute", "leaderboard"])
        XCTAssertTrue(element(app, "boardRow-1").waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "promoteBand").exists, "the league shows the band after the fifth row")
        XCTAssertTrue(element(app, "leagueName").exists)

        app.buttons["board-1"].tap()
        XCTAssertTrue(element(app, "boardRow-3").waitForExistence(timeout: 10))
        XCTAssertFalse(element(app, "promoteBand").exists)

        app.buttons["board-2"].tap()
        XCTAssertTrue(element(app, "globalHidden").waitForExistence(timeout: 10), "someone who keeps off the global list is told so")
        XCTAssertTrue(element(app, "boardRow-42").exists, "and sees only their own row")
        XCTAssertFalse(element(app, "boardRow-1").exists)
    }

    @MainActor func testBlockingAPersonAsksFirstAndClosesTheirPage() {
        let app = launch(["-beytRoute", "person:sara.ghazal"])
        let menu = app.buttons["personMenu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "personName").exists)
        menu.tap()
        app.buttons["بلاک"].tap()

        XCTAssertTrue(app.staticTexts["blockTitle"].waitForExistence(timeout: 10))
        XCTAssertEqual(plain(app.staticTexts["blockTitle"].label), "سارا بلاک بشه؟")
        XCTAssertTrue(app.staticTexts["دیگه نمی‌تونه بهت پیام بده یا دنبالت کنه."].exists)
        app.buttons["blockCancel"].tap()
        XCTAssertTrue(element(app, "personName").waitForExistence(timeout: 10), "«نه» stays on the page")

        menu.tap()
        app.buttons["بلاک"].tap()
        let confirm = app.buttons["blockConfirm"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        let gone = NSPredicate(format: "exists == false")
        expectation(for: gone, evaluatedWith: element(app, "personName"))
        waitForExpectations(timeout: 10)
    }

    @MainActor func testReportingAPersonThanksThem() {
        let app = launch(["-beytRoute", "person:kian_k"])
        let menu = app.buttons["personMenu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 10))
        menu.tap()
        app.buttons["گزارش"].tap()
        app.buttons["reason-abuse"].tap()
        app.buttons["reportSend"].tap()
        XCTAssertTrue(app.staticTexts["گزارشت رسید"].waitForExistence(timeout: 10))
    }

    @MainActor func testTheGamesTabGreetsAndOpensTheLeaderboardFromThePoints() {
        let app = launch(["-beytTab", "games"])
        XCTAssertTrue(app.staticTexts["greeting"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["greeting"].label, "سلام نیلوفر!")
        XCTAssertTrue(app.staticTexts["dailyFriends"].waitForExistence(timeout: 10))
        app.buttons["leaderboardLink"].tap()
        XCTAssertTrue(element(app, "boardRow-1").waitForExistence(timeout: 10))
    }

    @MainActor func testAGuestIsAskedForAnAccountBeforeTheLeaderboard() {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9", "-beytTab", "games"]
        app.launch()
        XCTAssertFalse(app.staticTexts["greeting"].exists)
        XCTAssertFalse(app.staticTexts["dailyFriends"].exists)
        let link = app.buttons["leaderboardLink"]
        XCTAssertTrue(link.waitForExistence(timeout: 10))
        link.tap()
        XCTAssertTrue(app.buttons["gateLater"].waitForExistence(timeout: 10))
    }

    @MainActor func testTheHomeFeedShowsWhatFriendsDid() {
        let app = launch(["-beytTab", "home"])
        let items = app.descendants(matching: .any).matching(identifier: "feedItem")
        XCTAssertTrue(items.firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["کیان یه بیت به اشتراک گذاشت"].exists)
    }

    @MainActor func testAGuestsHomeShowsNoFriendsSection() {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9", "-beytTab", "home"]
        app.launch()
        XCTAssertTrue(app.staticTexts["بیتِ امروز"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["پیدا کردن دوست"].exists)
    }

    // MARK: Pages load one at a time

    /// The fake server's friends count for me is the friends pages it served (plus 100 for each page of the feed after
    /// the first), so a list that asked for more pages than it showed would be seen here.
    @MainActor private func servedCount(_ app: XCUIApplication) -> String {
        app.buttons["من"].tap()
        let friends = app.buttons["profileFriends"]
        XCTAssertTrue(friends.waitForExistence(timeout: 10))
        return plain(friends.label)
    }

    @MainActor func testTheFriendsListAsksForItsNextPageOnlyWhenTheEndComesIntoView() {
        let app = launch(["-beytRoute", "friends"])
        XCTAssertTrue(element(app, "person-sara.ghazal").waitForExistence(timeout: 10))
        app.buttons["back"].tap()
        XCTAssertEqual(servedCount(app), "۱ دوست", "only the first page was asked for")

        app.buttons["profileFriends"].tap()
        let last = element(app, "person-friend77")
        for _ in 0..<30 where !last.exists { app.swipeUp() }
        XCTAssertTrue(last.waitForExistence(timeout: 10), "scrolling to the end brought the second page")
    }

    @MainActor func testTheHomeFeedAsksForItsNextPageOnlyWhenTheEndComesIntoView() {
        let app = launch(["-beytTab", "home"])
        XCTAssertTrue(element(app, "feedItem").firstMatch.waitForExistence(timeout: 10))
        XCTAssertEqual(servedCount(app), "۰ دوست", "the second page of the feed was not asked for")
    }
}
