import XCTest

final class MeUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String], fresh: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: the fake sign-in is answered on the phone.
        app.launchArguments = (fresh ? ["-beytFresh", "1"] : []) + ["-beytAPI", "http://127.0.0.1:9"] + arguments
        app.launch()
        return app
    }

    /// A label without the invisible direction marks that SwiftUI puts around numbers in right-to-left text.
    private func plain(_ text: String) -> String {
        text.filter { !("\u{2066}"..."\u{2069}").contains($0) }
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    @MainActor private func waitForDisappearance(of element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element)
        return XCTWaiter().wait(for: [gone], timeout: timeout) == .completed
    }

    @MainActor func testProfileLeadsToTheDivanAndACoupletOpensTheReader() {
        let app = launch(["-beytRoute", "me", "-beytSeedDivan", "1"])
        let all = app.buttons["openDivan"]
        XCTAssertTrue(all.waitForExistence(timeout: 10))
        XCTAssertEqual(plain(all.label), "همه‌ی ۲۰ بیت")
        all.tap()

        let card = element(app, "divanCouplet-/hafez/ghazal/sh1#0")
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["divanCount"].exists)
        XCTAssertEqual(plain(app.staticTexts["divanCount"].label), "۲۰ بیت")
        card.tap()

        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
        XCTAssertEqual(plain(app.staticTexts["readerTitle"].label), "غزل ۱")
    }

    @MainActor func testTakingACoupletOutOfTheDivanRemovesItFromTheListAndTheCount() {
        let app = launch(["-beytRoute", "divan", "-beytSeedDivan", "1"])
        let unkeep = app.buttons["unkeep-/hafez/ghazal/sh1#0"]
        XCTAssertTrue(unkeep.waitForExistence(timeout: 10))
        unkeep.tap()
        XCTAssertTrue(waitForDisappearance(of: unkeep))
        XCTAssertEqual(plain(app.staticTexts["divanCount"].label), "۱۹ بیت")
    }

    @MainActor func testAChangedFaceIsSavedShowsOnTheProfileAndTheTabBarAndSurvivesARestart() {
        let app = launch(["-beytRoute", "avatar"])
        let ney = app.buttons["avatarItem-ney"]
        XCTAssertTrue(ney.waitForExistence(timeout: 10))
        XCTAssertTrue(ney.isSelected)
        let rose = app.buttons["avatarItem-rose"]
        rose.tap()
        XCTAssertTrue(rose.isSelected)
        XCTAssertFalse(ney.isSelected)

        // A locked item cannot be chosen.
        let crown = app.buttons["avatarItem-crown"]
        crown.tap()
        XCTAssertFalse(crown.isSelected)
        XCTAssertTrue(rose.isSelected)

        app.buttons["avatarSave"].tap()
        let edit = app.buttons["editAvatar"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        XCTAssertEqual(edit.value as? String, "چهره‌ی تو، با گل سرخِ حافظ")
        XCTAssertEqual(app.buttons["من"].value as? String, "چهره‌ی تو، با گل سرخِ حافظ")

        app.terminate()
        let again = launch(["-beytRoute", "me"], fresh: false)
        let editAgain = again.buttons["editAvatar"]
        XCTAssertTrue(editAgain.waitForExistence(timeout: 10))
        XCTAssertEqual(editAgain.value as? String, "چهره‌ی تو، با گل سرخِ حافظ")
        XCTAssertEqual(again.buttons["من"].value as? String, "چهره‌ی تو، با گل سرخِ حافظ")
    }

    @MainActor func testDeletingTheAccountAsksOnceMoreAndLeavesAGuest() {
        let app = launch(["-beytRoute", "settings", "-beytSignedIn", "1"])
        let delete = app.buttons["deleteAccount"]
        XCTAssertTrue(delete.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["settingsSignIn"].exists)

        delete.tap()
        let title = app.staticTexts["deleteTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        XCTAssertEqual(title.label, "حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟")
        app.buttons["deleteCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(delete.exists)  // «نه» changes nothing

        delete.tap()
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        app.buttons["deleteConfirm"].tap()
        XCTAssertTrue(app.buttons["settingsSignIn"].waitForExistence(timeout: 10))  // a guest now
        XCTAssertFalse(app.buttons["deleteAccount"].exists)
    }

    @MainActor func testLongPressOnADivanCardOpensTheReadersHoldMenu() {
        let app = launch(["-beytRoute", "divan", "-beytSeedDivan", "1"])
        let card = element(app, "divanCouplet-/hafez/ghazal/sh1#0")
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        card.press(forDuration: 1.0)
        XCTAssertTrue(element(app, "کارهای این بیت").waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["نگه دار"].exists)
        XCTAssertTrue(app.buttons["بفرست"].exists)
        // «بیت به بیت، از همین بیت» opens the reader on that couplet.
        app.buttons["بیت به بیت، از همین بیت"].tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
    }

    @MainActor func testAGuestSeesTheSignInRowInSettingsAndTheGuestProfile() {
        let app = launch(["-beytRoute", "settings"])
        XCTAssertTrue(app.buttons["settingsSignIn"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["deleteAccount"].exists)
        XCTAssertFalse(app.buttons["signOut"].exists)
        app.buttons["back"].tap()
        XCTAssertEqual(app.staticTexts["profileName"].label, "مهمان")
        XCTAssertTrue(app.buttons["profileSignIn"].exists)
    }

    @MainActor func testInviteAsksAGuestForAnAccountFirst() {
        let app = launch(["-beytRoute", "me"])
        app.buttons["inviteFriends"].tap()
        XCTAssertTrue(app.staticTexts["gateTitle"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["gateTitle"].label.contains("دعوت دوستات"))
    }

    @MainActor func testTheInviteTextFollowsTheTone() {
        let app = launch(["-beytRoute", "invite", "-beytSignedIn", "1"])
        let body = app.staticTexts["inviteBody"]
        XCTAssertTrue(body.waitForExistence(timeout: 10))
        XCTAssertTrue(body.label.hasPrefix("یه اپ پیدا کردم"))
        XCTAssertEqual(app.staticTexts["inviteLink"].label, "yebeyt.com/i/niloofar")
        app.buttons["tone-2"].tap()
        XCTAssertEqual(body.label, "بیا با هم مشاعره کنیم:")
        app.buttons["copyLink"].tap()
        XCTAssertTrue(app.staticTexts["toast"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["toast"].label, "کپی شد")
    }

    @MainActor func testPrivacyChoicesStick() {
        let app = launch(["-beytRoute", "privacy"])
        let me = app.buttons["privacy-kept-1"]
        XCTAssertTrue(me.waitForExistence(timeout: 10))
        XCTAssertFalse(me.isSelected)
        me.tap()
        XCTAssertTrue(me.isSelected)
        XCTAssertFalse(app.buttons["privacy-kept-0"].isSelected)
    }
}
