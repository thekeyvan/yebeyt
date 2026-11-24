import XCTest

final class MessagesUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: the fake sign-in and the server are answered on the phone.
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9", "-beytSignedIn", "1"] + arguments
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func firstElement(_ app: XCUIApplication, identifierPrefix prefix: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix)).firstMatch
    }

    @MainActor func testTheInboxOpensAChatAndASentTextAppears() {
        let app = launch(["-beytRoute", "inbox"])
        let sara = element(app, "inboxRow-sara")
        XCTAssertTrue(sara.waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "inboxRow-kian").exists)

        // The search only filters the rows that are there.
        let search = app.textFields.firstMatch
        search.tap()
        search.typeText("kian")
        XCTAssertTrue(element(app, "inboxRow-kian").exists)
        XCTAssertFalse(element(app, "inboxRow-sara").exists)
        search.clearText()
        XCTAssertTrue(element(app, "inboxRow-sara").waitForExistence(timeout: 5))

        element(app, "inboxRow-sara").tap()
        let composer = app.textFields["composer"]
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "coupletCard-m1").waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "bubble-m3").exists)
        XCTAssertTrue(element(app, "bubble-m3").label.contains("دیده شد"))
        XCTAssertTrue(element(app, "gameCard-g1").exists)

        composer.tap()
        composer.typeText("salam")
        app.buttons["sendMessage"].tap()
        let sent = firstElement(app, identifierPrefix: "bubble-sent-")
        XCTAssertTrue(sent.waitForExistence(timeout: 10))
        XCTAssertTrue(sent.label.contains("salam"))
        XCTAssertFalse((composer.value as? String ?? "").contains("salam"))  // the field is empty again
    }

    @MainActor func testLongPressingACoupletCardOffersTheSharedDivanAndAddsTheCouplet() {
        let app = launch(["-beytRoute", "chat:sara"])
        let card = element(app, "coupletCard-m1")
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        card.press(forDuration: 1.0)

        let toDivan = app.buttons["به دیوان مشترک"]
        XCTAssertTrue(toDivan.waitForExistence(timeout: 5))
        toDivan.tap()
        // In a chat the person is known: only the note is asked.
        let add = app.buttons["divanAdd"]
        XCTAssertTrue(add.waitForExistence(timeout: 5))
        app.textFields["divanNote"].tap()
        app.textFields["divanNote"].typeText("note")
        add.tap()
        XCTAssertTrue(app.staticTexts["به دیوان من و سارا اضافه شد"].waitForExistence(timeout: 5))
    }

    @MainActor func testTheHoldMenuOfTheReaderListsFriendsWithASharedDivan() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh8", "-beytCouplet", "4", "-beytHold", "4"])
        let toDivan = app.buttons["به دیوان مشترک"]
        XCTAssertTrue(toDivan.waitForExistence(timeout: 10))
        toDivan.tap()
        XCTAssertTrue(element(app, "divanWith-sara").waitForExistence(timeout: 5))
        XCTAssertTrue(element(app, "divanWith-kian").exists)
        XCTAssertTrue(app.buttons["otherFriend"].exists)
        app.buttons["otherFriend"].tap()
        XCTAssertTrue(element(app, "divanWith-arian").waitForExistence(timeout: 5))
        XCTAssertTrue(element(app, "divanWith-sara").exists)  // the friends with a divan stay listed above
        element(app, "divanWith-sara").tap()
        XCTAssertTrue(app.buttons["divanAdd"].waitForExistence(timeout: 5))
    }

    @MainActor func testTheDivanLineInAChatOpensTheSharedDivan() {
        let app = launch(["-beytRoute", "chat:kian"])
        let line = element(app, "divanLine-k2")
        XCTAssertTrue(line.waitForExistence(timeout: 10))
        line.tap()
        XCTAssertTrue(app.buttons["addToDivan"].waitForExistence(timeout: 10))
    }

    @MainActor func testTheSharedDivanFiltersByWhoAddedAndByPoetAndLikes() {
        let app = launch(["-beytRoute", "shared:sara"])
        XCTAssertTrue(element(app, "sharedItem-i1").waitForExistence(timeout: 10))
        XCTAssertTrue(element(app, "sharedItem-i2").exists)
        XCTAssertTrue(element(app, "sharedItem-i3").exists)

        app.buttons["chip-me"].tap()
        XCTAssertTrue(element(app, "sharedItem-i2").waitForExistence(timeout: 5))
        XCTAssertFalse(element(app, "sharedItem-i1").exists)

        app.buttons["chip-them"].tap()
        XCTAssertTrue(element(app, "sharedItem-i1").waitForExistence(timeout: 5))
        XCTAssertFalse(element(app, "sharedItem-i2").exists)

        app.buttons["chip-khayyam"].tap()
        XCTAssertTrue(element(app, "sharedItem-i2").waitForExistence(timeout: 5))
        XCTAssertFalse(element(app, "sharedItem-i1").exists)

        app.buttons["chip-all"].tap()
        XCTAssertTrue(element(app, "sharedItem-i3").waitForExistence(timeout: 5))
        let like = app.buttons["like-i3"]
        XCTAssertEqual((like.value as? String)?.filter { !("\u{2066}"..."\u{2069}").contains($0) }, "۰")
        like.tap()
        let liked = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "تو پسندیدی"), object: like)
        XCTAssertEqual(XCTWaiter().wait(for: [liked], timeout: 5), .completed)
    }
}

private extension XCUIElement {
    /// Deletes what is typed in a text field.
    func clearText() {
        guard let text = value as? String, !text.isEmpty else { return }
        tap()
        typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: text.count))
    }
}
