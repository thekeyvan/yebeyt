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
        assertSheetFits(app, title: title, lastButton: app.buttons["deleteConfirm"])
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

    /// «بیرون برو» on the question that comes first.
    @MainActor private func confirmSignOut(_ app: XCUIApplication) {
        let confirm = app.buttons["signOutAskConfirm"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
    }

    @MainActor func testSigningOutAsksFirstAndSayingNoKeepsTheAccount() {
        let app = launch(["-beytRoute", "settings", "-beytSignedIn", "1", "-beytSeedDivan", "1"])
        let signOut = app.buttons["signOut"]
        XCTAssertTrue(signOut.waitForExistence(timeout: 10))
        signOut.tap()
        let title = app.staticTexts["signOutAskTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertEqual(title.label, "از حسابت بیرون بری؟")
        XCTAssertEqual(app.staticTexts["signOutAskMessage"].label, "دیوانت به حسابت همگام می‌شه و از این گوشی پاک می‌شه؛ با ورود دوباره برمی‌گرده.")
        XCTAssertEqual(app.buttons["signOutAskCancel"].label, "نه")
        XCTAssertEqual(app.buttons["signOutAskConfirm"].label, "بیرون برو")
        app.buttons["signOutAskCancel"].tap()
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(signOut.exists)
        XCTAssertFalse(app.buttons["settingsSignIn"].exists, "«نه» keeps the account")
    }

    @MainActor func testSigningOutWithAnUnsyncedDivanWarnsFirstAndOnlyInsistingLeaves() {
        let app = launch(["-beytRoute", "settings", "-beytSignedIn", "1", "-beytSyncFails", "1", "-beytSeedDivan", "1"])
        let signOut = app.buttons["signOut"]
        XCTAssertTrue(signOut.waitForExistence(timeout: 10))
        signOut.tap()
        confirmSignOut(app)
        let title = app.staticTexts["unsyncedTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertEqual(title.label, "همه‌ی بیت‌هات هنوز به حسابت نرسیده. اگه الان خارج بشی، از این گوشی پاک می‌شن.")
        assertSheetFits(app, title: title, lastButton: app.buttons["unsyncedLeave"])

        app.buttons["unsyncedStay"].tap()  // «بمونم»
        XCTAssertTrue(waitForDisappearance(of: title))
        XCTAssertTrue(signOut.exists)  // still signed in
        XCTAssertFalse(app.buttons["settingsSignIn"].exists)

        signOut.tap()
        confirmSignOut(app)
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        app.buttons["unsyncedLeave"].tap()  // «خروج»
        XCTAssertTrue(app.buttons["settingsSignIn"].waitForExistence(timeout: 10))  // a guest now
        XCTAssertFalse(app.buttons["signOut"].exists)
    }

    @MainActor func testSigningOutWhenTheSyncWorksNeedsNoWarning() {
        let app = launch(["-beytRoute", "settings", "-beytSignedIn", "1", "-beytSeedDivan", "1"])
        app.buttons["signOut"].tap()
        confirmSignOut(app)
        XCTAssertTrue(app.buttons["settingsSignIn"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["unsyncedTitle"].exists)
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

    @MainActor func testSettingsShowTheEmailAndTheNewsSwitchStaysOnAfterReopening() {
        let app = launch(["-beytRoute", "settings", "-beytSignedIn", "1"])
        let email = element(app, "settingsEmail")
        XCTAssertTrue(email.waitForExistence(timeout: 10))
        XCTAssertTrue(email.label.contains("niloofar@example.com"))
        XCTAssertTrue(email.label.contains("ایمیل"))
        XCTAssertFalse(app.buttons["settingsEmail"].exists, "the email is not a button")
        // The note is the switch's hint, so VoiceOver reads it once: the line itself is hidden from accessibility.
        XCTAssertFalse(app.staticTexts["settingsNewsNote"].exists)
        let news = element(app, "settingsNews")
        XCTAssertTrue(news.exists)
        XCTAssertEqual(news.value as? String, "0")  // the switch is off

        news.tap()
        let on = NSPredicate(format: "value == %@", "1")
        XCTAssertEqual(XCTWaiter().wait(for: [XCTNSPredicateExpectation(predicate: on, object: news)], timeout: 5), .completed)

        app.buttons["back"].tap()
        app.buttons["settings"].tap()
        XCTAssertTrue(element(app, "settingsNews").waitForExistence(timeout: 10))
        XCTAssertEqual(element(app, "settingsNews").value as? String, "1")  // still on
    }

    @MainActor func testAGuestSeesNeitherTheEmailNorTheNewsSwitch() {
        let app = launch(["-beytRoute", "settings"])
        XCTAssertTrue(app.buttons["settingsSignIn"].waitForExistence(timeout: 10))
        XCTAssertFalse(element(app, "settingsEmail").exists)
        XCTAssertFalse(element(app, "settingsNews").exists)
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
