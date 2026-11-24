import XCTest

/// Games with friends, with the phone answering for the server (`PlayStub`) and the fake live socket playing the other player.
final class PlayUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String], signedIn: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: the fake sign-in and the server are answered on the phone.
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9"] + (signedIn ? ["-beytSignedIn", "1"] : []) + arguments
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func first(_ app: XCUIApplication, prefix: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix)).firstMatch
    }

    // MARK: Lobby

    @MainActor func testTheLobbyMakesAMoshGameWithAFriendAndPlayMoshShows() {
        let app = launch(["-beytRoute", "lobby"])
        XCTAssertTrue(element(app, "lobby").waitForExistence(timeout: 10))
        let sara = element(app, "lobbyPerson-sara.ghazal")
        XCTAssertTrue(sara.waitForExistence(timeout: 10))
        sara.tap()
        XCTAssertTrue(sara.isSelected)
        app.buttons["lobbyCreate"].tap()
        XCTAssertTrue(element(app, "mosh").waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "moshWaiting").waitForExistence(timeout: 10))  // the friend has not come yet
    }

    @MainActor func testTheTurnTimeIsOnlyForMoshAndJigsawStartsARound() {
        let app = launch(["-beytRoute", "lobby"])
        XCTAssertTrue(app.buttons["lobbyTurn-0"].waitForExistence(timeout: 10))
        app.buttons["lobbyGame-duel"].tap()
        XCTAssertFalse(app.buttons["lobbyTurn-0"].exists)
        app.buttons["lobbyGame-jigsaw"].tap()
        XCTAssertFalse(element(app, "lobbyLink").exists)  // the link of a challenge comes after the round
        app.buttons["lobbyCreate"].tap()
        XCTAssertTrue(element(app, "progress").waitForExistence(timeout: 10))  // the jigsaw round
    }

    @MainActor func testTheQuickActionsOfAChatOpenTheLobbyWithThatFriend() {
        let app = launch(["-beytRoute", "chat:sara.ghazal"])
        let quick = app.buttons["quickMosh"]
        XCTAssertTrue(quick.waitForExistence(timeout: 10))
        XCTAssertTrue(quick.isEnabled && app.buttons["quickDuel"].isEnabled && app.buttons["quickDaily"].isEnabled)
        quick.tap()
        XCTAssertTrue(element(app, "lobby").waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "lobbyPerson-sara.ghazal").waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "lobbyPerson-sara.ghazal").isSelected)
    }

    @MainActor func testTheGamesTabHasTheMoshCardAndTheNewGameButton() {
        let app = launch(["-beytTab", "games"])
        XCTAssertTrue(element(app, "moshCard").waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "moshActive").waitForExistence(timeout: 10))  // Sara answered: my turn
        element(app, "moshActive").tap()
        XCTAssertTrue(element(app, "mosh").waitForExistence(timeout: 10))
        app.buttons["gameClose"].tap()
        app.buttons["newFriendGame"].tap()
        XCTAssertTrue(element(app, "lobby").waitForExistence(timeout: 10))
    }

    // MARK: PlayMosh

    @MainActor func testPickingASuggestionPlaysItAndTheAnswerArrivesLive() {
        let app = launch(["-beytRoute", "mosh"])
        XCTAssertTrue(element(app, "moshLetter").waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "moshLetter").label.contains("د"))
        XCTAssertTrue(element(app, "moshMove-2").exists)
        let suggestion = first(app, prefix: "moshSuggestion-")
        XCTAssertTrue(suggestion.waitForExistence(timeout: 20))  // the books are read the first time
        suggestion.tap()
        XCTAssertTrue(element(app, "moshMove-3").waitForExistence(timeout: 10))  // mine
        XCTAssertTrue(element(app, "moshMove-4").waitForExistence(timeout: 10))  // her answer, over the socket
        XCTAssertTrue(element(app, "moshLetter").waitForExistence(timeout: 10))  // my turn again
    }

    @MainActor func testTypedTextThatIsInNoBookIsNotSent() {
        let app = launch(["-beytRoute", "mosh"])
        let field = app.textFields["moshField"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText("دلم میخواد یه بیت بگم\n")
        XCTAssertTrue(app.staticTexts["این بیت رو پیدا نکردیم"].waitForExistence(timeout: 20))
        XCTAssertFalse(element(app, "moshMove-3").exists)
    }

    @MainActor func testGivingUpAsksOnceAndEndsTheGame() {
        let app = launch(["-beytRoute", "mosh"])
        let resign = app.buttons["moshResign"]
        XCTAssertTrue(resign.waitForExistence(timeout: 10))
        resign.tap()
        app.sheets.buttons["کم آوردم"].tap()  // the question asked once
        XCTAssertTrue(element(app, "moshOutcome").waitForExistence(timeout: 10))
        XCTAssertEqual(element(app, "moshOutcome").label, "سارا برد")
    }

    @MainActor func testTheChatsMoshCardShowsTheStateAndOpensTheGame() {
        let app = launch(["-beytRoute", "chat:sara.ghazal"])
        XCTAssertTrue(element(app, "gameCard-g1").waitForExistence(timeout: 10))
        let go = element(app, "gameGo-g1")
        XCTAssertTrue(go.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["نوبت توئه، با حرف «د»"].waitForExistence(timeout: 10))
        go.tap()
        XCTAssertTrue(element(app, "moshLetter").waitForExistence(timeout: 10))
    }

    // MARK: PlayDuel

    @MainActor func testTheDuelPlaysThroughFakeLiveEventsToItsEnd() {
        let app = launch(["-beytRoute", "duel"])
        let first = element(app, "duelOption-0")
        XCTAssertTrue(first.waitForExistence(timeout: 15))  // round four: the question came over the socket
        XCTAssertTrue(element(app, "duelAnswered").exists)  // Sara is out of it
        XCTAssertTrue(element(app, "duelKind").label.contains("مصراع دوم"))
        first.tap()
        XCTAssertTrue(element(app, "duelFooter").waitForExistence(timeout: 10))
        // Round five asks who said it: four poets.
        let poet = element(app, "duelOption-2")
        XCTAssertTrue(poet.waitForExistence(timeout: 15))
        XCTAssertTrue(element(app, "duelKind").label.contains("حدس شاعر"))
        poet.tap()
        XCTAssertTrue(element(app, "roundEndTitle").waitForExistence(timeout: 15))
        XCTAssertEqual(element(app, "roundEndTitle").label, "بردی!")
    }

    // MARK: Challenges

    @MainActor func testTheEndOfARoundOffersAChallengeToASignedInPlayer() {
        let app = launch(["-beytRoute", "challenge-send"])
        XCTAssertTrue(element(app, "challengeSend").waitForExistence(timeout: 15))
        let link = element(app, "challengeLink")
        XCTAssertTrue(link.waitForExistence(timeout: 10))
        let made = NSPredicate(format: "label CONTAINS %@", "yebeyt.com/c/7KQ2")
        XCTAssertEqual(XCTWaiter().wait(for: [XCTNSPredicateExpectation(predicate: made, object: link)], timeout: 10), .completed)
        XCTAssertTrue(app.buttons["copyLink"].exists && app.buttons["story"].exists)
        XCTAssertTrue(app.buttons["challengePick"].exists)
    }

    @MainActor func testAGuestAnswersAChallengeAndLeavesAName() {
        let app = launch(["-beytPlayStub", "1", "-beytRoute", "challenge:7KQ2", "-beytPlay", "10"], signedIn: false)
        XCTAssertTrue(element(app, "challengeAccept").waitForExistence(timeout: 10))
        XCTAssertEqual(element(app, "challengeTitle").label, "نیلوفر منتظرته")
        XCTAssertTrue(app.staticTexts["حساب نمی‌خواد"].exists)
        app.buttons["challengeStart"].tap()
        let name = app.textFields["challengeName"]
        XCTAssertTrue(name.waitForExistence(timeout: 15))  // the round is played out: a name is asked
        name.tap()
        name.typeText("کیان")
        app.buttons["challengeSendName"].tap()
        XCTAssertTrue(app.staticTexts["مساوی"].waitForExistence(timeout: 10))  // 8 of 10 against 8 of 10
        XCTAssertTrue(app.staticTexts["تو ۸ · نیلوفر ۸"].exists)
    }
}
