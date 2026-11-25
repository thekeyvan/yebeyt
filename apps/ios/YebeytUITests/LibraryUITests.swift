import XCTest

final class LibraryUITests: XCTestCase {
    /// Every test starts without anything read, followed or kept.
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1"] + arguments
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    @MainActor func testExploreToLibraryToBookToSectionToReaderAndBackAgain() {
        let app = launch(["-beytTab", "explore"])
        let search = app.buttons["searchField"]
        XCTAssertTrue(search.waitForExistence(timeout: 10))

        app.buttons["همه‌ی کتاب‌ها"].tap()
        let hafez = app.buttons["book-9"]
        XCTAssertTrue(hafez.waitForExistence(timeout: 5))
        hafez.tap()

        let ghazals = app.buttons["section-24"]
        XCTAssertTrue(ghazals.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["primary"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.buttons["primary"].label, "شروع: غزل ۱")
        ghazals.tap()

        let third = app.buttons["poem-3"]
        XCTAssertTrue(third.waitForExistence(timeout: 5))
        third.tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["readerTitle"].label, "غزل ۳")
        app.buttons["بستن"].tap()

        // the reader is a cover: closing it leaves the section where it was, and back goes up one screen at a time
        XCTAssertTrue(third.waitForExistence(timeout: 5))
        app.buttons["back"].tap()
        XCTAssertTrue(ghazals.waitForExistence(timeout: 5))
        app.buttons["back"].tap()
        XCTAssertTrue(hafez.waitForExistence(timeout: 5))
        app.buttons["back"].tap()
        XCTAssertTrue(search.waitForExistence(timeout: 5))
    }

    @MainActor func testLibraryShowsContinueOnlyAfterSomethingWasRead() {
        let app = launch(["-beytRoute", "library"])
        let hafez = app.buttons["book-9"]
        XCTAssertTrue(hafez.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["continue"].exists)

        hafez.tap()
        XCTAssertTrue(app.buttons["primary"].waitForExistence(timeout: 5))
        app.buttons["primary"].tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
        app.buttons["بستن"].tap()

        XCTAssertTrue(app.buttons["primary"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["primary"].label.hasPrefix("ادامه: غزل ۱"))
        app.buttons["back"].tap()
        XCTAssertTrue(app.buttons["continue"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["continue"].label.contains("دیوان حافظ"))
    }

    @MainActor func testASectionMarksReadAndInProgressPoems() {
        let app = launch(["-beytRoute", "section:/hafez/ghazal"])
        let first = app.buttons["poem-1"]
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        XCTAssertFalse(first.label.contains("خوندی"))
        first.tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
        app.buttons["کل شعر"].tap()  // a short poem: its end is on screen, so it is read
        app.buttons["بستن"].tap()
        XCTAssertTrue(first.waitForExistence(timeout: 5))
        XCTAssertTrue(first.label.contains("خوندی"))

        let second = app.buttons["poem-2"]
        second.tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
        app.buttons["بستن"].tap()
        XCTAssertTrue(second.waitForExistence(timeout: 5))
        XCTAssertTrue(second.label.contains("داری می‌خونی"))
        XCTAssertFalse(second.label.contains("خوندی"))
        XCTAssertFalse(first.label.contains("داری می‌خونی"))
    }

    @MainActor func testSortingChangesTheOrderOfTheList() {
        let app = launch(["-beytRoute", "section:/hafez/ghazal"])
        XCTAssertTrue(app.buttons["poem-1"].waitForExistence(timeout: 10))
        let firstRowBefore = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'poem-'")).firstMatch.identifier
        XCTAssertEqual(firstRowBefore, "poem-1")
        app.buttons["حرف آخر"].tap()
        let firstRowAfter = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'poem-'")).firstMatch
        XCTAssertTrue(firstRowAfter.waitForExistence(timeout: 5))
        XCTAssertNotEqual(firstRowAfter.identifier, "poem-1")
    }

    @MainActor func testSearchingASectionFindsAPoemByNumber() {
        let app = launch(["-beytRoute", "section:/hafez/ghazal"])
        XCTAssertTrue(app.buttons["poem-1"].waitForExistence(timeout: 10))
        let field = app.textFields.firstMatch
        field.tap()
        field.typeText("۱۲")
        XCTAssertTrue(app.buttons["poem-12"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["poem-1"].exists)
    }

    @MainActor func testThePoetPageOpensFromTheBookAndFollowKeepsItsState() {
        let app = launch(["-beytRoute", "book:/hafez"])
        let chip = app.buttons["poetChip"]
        XCTAssertTrue(chip.waitForExistence(timeout: 10))
        chip.tap()
        let follow = app.buttons["follow"]
        XCTAssertTrue(follow.waitForExistence(timeout: 5))
        XCTAssertEqual(follow.label, "دنبال کن")
        follow.tap()
        XCTAssertEqual(app.buttons["follow"].label, "دنبال می‌کنی")
        XCTAssertTrue(app.buttons["top-1"].waitForExistence(timeout: 5))
        app.buttons["top-1"].tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
    }

    /// The chips of the library run to the screen edge; the swipe that starts there at their height still goes back.
    @MainActor func testTheEdgeSwipeGoesBackFromTheHeightOfTheLibraryChips() {
        let app = launch(["-beytRoute", "library"])
        let all = app.buttons["همه"]
        XCTAssertTrue(all.waitForExistence(timeout: 10))
        edgeSwipeBack(app, atHeightOf: all)
        XCTAssertTrue(app.buttons["searchField"].waitForExistence(timeout: 8), "the swipe goes back to explore")
    }

    @MainActor func testLongPoetNamesStayOnOneLineOnThePoetCard() {
        for (slug, name) in [("naserkhosro", "ناصرخسرو"), ("bahar", "ملک‌الشعرا بهار"), ("hafez", "حافظ")] {
            let app = launch(["-beytRoute", "poet:\(slug)"])
            let title = app.staticTexts["poetName"]
            XCTAssertTrue(title.waitForExistence(timeout: 10), slug)
            XCTAssertEqual(title.label, name)
            // one line of Lalezar at 64 is about 100pt of line box, two would be twice that
            XCTAssertLessThan(title.frame.height, 130, "\(name) wrapped")
            XCTAssertLessThanOrEqual(title.frame.maxX, app.windows.firstMatch.frame.maxX)
            app.terminate()
        }
    }

    @MainActor func testTheReadersPoetButtonOpensThePoetPageInExplore() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3"])
        let subtitle = element(app, "readerSubtitle")
        XCTAssertTrue(subtitle.waitForExistence(timeout: 10))
        subtitle.tap()
        XCTAssertTrue(app.buttons["follow"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["readerTitle"].exists)
        XCTAssertTrue(app.buttons["کاوش"].isSelected)
        app.buttons["back"].tap()
        XCTAssertTrue(app.buttons["searchField"].waitForExistence(timeout: 5))
    }
}
