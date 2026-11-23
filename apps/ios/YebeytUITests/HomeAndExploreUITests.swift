import XCTest

final class HomeAndExploreUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1"] + arguments
        app.launch()
        return app
    }

    @MainActor func testTheDailyCoupletCanBeKeptRejectedAndOpened() {
        let app = launch([])
        let couplet = app.buttons["dailyCouplet"]
        XCTAssertTrue(couplet.waitForExistence(timeout: 10))
        let before = couplet.label

        let keep = app.buttons["keep"]
        XCTAssertFalse(keep.isSelected)
        keep.tap()
        XCTAssertTrue(keep.isSelected)

        app.buttons["reject"].tap()
        let changed = NSPredicate(format: "label != %@", before)
        expectation(for: changed, evaluatedWith: couplet)
        waitForExpectations(timeout: 5)
        XCTAssertFalse(app.buttons["keep"].isSelected)  // the next couplet is a different one

        couplet.tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
    }

    @MainActor func testTheSearchFieldOpensSearchWithTheKeyboardUp() {
        let app = launch(["-beytTab", "explore"])
        app.buttons["searchField"].tap()
        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    }

    @MainActor func testSearchFindsPoetsBooksAndCouplets() {
        let app = launch(["-beytRoute", "search:حافظ"])
        XCTAssertTrue(app.staticTexts["شاعرها"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["کتاب‌ها"].exists)
    }

    @MainActor func testSearchWithoutAMatchSaysSo() {
        let app = launch(["-beytRoute", "search:zzzzqq"])
        XCTAssertTrue(app.staticTexts["چیزی پیدا نشد"].waitForExistence(timeout: 10))
    }

    @MainActor func testAMoodListsCoupletsAndOpensOneInTheReader() {
        let app = launch(["-beytTab", "explore"])
        let chip = app.buttons["عشق"]
        XCTAssertTrue(chip.waitForExistence(timeout: 10))
        chip.tap()
        let row = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'couplet-'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
    }

    @MainActor func testTheFalOpensAHafezGhazalInTheWholePoemView() {
        let app = launch(["-beytTab", "explore"])
        let fal = app.buttons["fal"]
        XCTAssertTrue(fal.waitForExistence(timeout: 10))
        fal.tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.descendants(matching: .any)["readerSubtitle"].label.hasPrefix("حافظ"))
        XCTAssertTrue(app.buttons["کل شعر"].isSelected)
    }

    @MainActor func testAllPoetsOpensFromTheExploreRow() {
        let app = launch(["-beytTab", "explore"])
        app.buttons["همه"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["شاعرها"].waitForExistence(timeout: 5))
        app.buttons["back"].tap()
        XCTAssertTrue(app.buttons["searchField"].waitForExistence(timeout: 5))
    }
}
