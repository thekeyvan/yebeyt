import XCTest

final class AccountUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: nothing here signs in for real.
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9"] + arguments
        app.launch()
        return app
    }

    @MainActor func testOnboardingLeadsToTheHomeScreenWithoutAnAccount() {
        let app = launch(["-beytOnboarding", "welcome"])
        let start = app.buttons["onbStart"]
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["onbHaveAccount"].exists)
        start.tap()

        let poet = app.buttons["poet-hafez"]  // the taste step
        XCTAssertTrue(poet.waitForExistence(timeout: 5))
        XCTAssertFalse(poet.isSelected)
        poet.tap()
        XCTAssertTrue(poet.isSelected)
        app.buttons["mood-love"].tap()
        app.buttons["onbNext"].tap()

        XCTAssertTrue(app.buttons["onbCheck"].waitForExistence(timeout: 5))  // the first game
        app.buttons["onbSkip"].tap()

        XCTAssertTrue(app.buttons["onbNoAccount"].waitForExistence(timeout: 5))  // the account step
        XCTAssertTrue(app.buttons["signInApple"].exists && app.buttons["signInGoogle"].exists)
        app.buttons["onbNoAccount"].tap()

        XCTAssertTrue(app.buttons["dailyCouplet"].waitForExistence(timeout: 10))  // home
        XCTAssertFalse(app.buttons["onbStart"].exists)
    }

    @MainActor func testSkipOnTheTasteStepGoesOneStepOn() {
        let app = launch(["-beytOnboarding", "taste"])
        app.buttons["onbSkip"].tap()
        XCTAssertTrue(app.buttons["onbCheck"].waitForExistence(timeout: 5))
    }

    @MainActor func testTheGateAppearsOnLikeForAGuestAndLaterLeavesTheCoupletUnliked() {
        let app = launch([])
        let like = app.buttons["پسند"]
        XCTAssertTrue(like.waitForExistence(timeout: 10))
        like.tap()
        let title = app.staticTexts["gateTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        XCTAssertTrue(title.label.contains("پسند و بازنشر"))
        XCTAssertTrue(app.buttons["signInApple"].exists && app.buttons["signInGoogle"].exists)
        app.buttons["gateLater"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertFalse(app.buttons["پسند"].isSelected)
    }

    @MainActor func testTheMessagesTabAsksForAnAccountAndStaysOnTheCurrentTab() {
        let app = launch([])
        XCTAssertTrue(app.buttons["dailyCouplet"].waitForExistence(timeout: 10))
        app.buttons["پیام‌ها"].tap()
        let title = app.staticTexts["gateTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        XCTAssertTrue(title.label.contains("پیام دادن به دوستات"))
        app.buttons["gateLater"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(app.buttons["خونه"].isSelected)
        XCTAssertFalse(app.buttons["پیام‌ها"].isSelected)
    }

    @MainActor func testASignedInPersonLikesWithoutTheGate() {
        let app = launch(["-beytSignedIn", "1"])
        let like = app.buttons["پسند"]
        XCTAssertTrue(like.waitForExistence(timeout: 10))
        like.tap()
        XCTAssertTrue(app.buttons["پسند"].isSelected)
        XCTAssertFalse(app.staticTexts["gateTitle"].exists)
    }

    @MainActor func testTheUsernameStepShowsAvailabilityAndTheInviteLink() {
        let app = launch(["-beytOnboarding", "username", "-beytSignedIn", "1"])
        XCTAssertTrue(app.staticTexts["usernameAvailable"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["usernameDone"].isEnabled)
        let field = app.textFields["username"]
        field.tap()
        field.typeText("x")  // «niloofarx»: the stand-in server says every name is free
        XCTAssertTrue(app.staticTexts["usernameAvailable"].waitForExistence(timeout: 5))
        field.typeText("!")  // not an allowed character
        XCTAssertTrue(app.staticTexts["usernameProblem"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["usernameDone"].isEnabled)
    }

    @MainActor private func waitForDisappearance(of element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element)
        return XCTWaiter().wait(for: [gone], timeout: timeout) == .completed
    }
}
