import XCTest

final class GamesUITests: XCTestCase {
    @MainActor private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytToday", "2026-11-23"] + arguments
        app.launch()
        return app
    }

    private func buttons(_ app: XCUIApplication, startingWith prefix: String, value: String? = nil) -> XCUIElementQuery {
        let format = value == nil ? "identifier BEGINSWITH %@" : "identifier BEGINSWITH %@ AND value == %@"
        return app.buttons.matching(NSPredicate(format: format, argumentArray: value == nil ? [prefix] : [prefix, value!]))
    }

    @MainActor func testTheTabShowsTodaysPuzzleAndTheCatalogOpens() {
        let app = launch(["-beytTab", "games"])
        XCTAssertTrue(app.buttons["dailyOpen"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.buttons["dailyOpen"].label, "بزن بریم")
        XCTAssertTrue(app.buttons["game-jigsaw"].isEnabled)
        XCTAssertFalse(app.buttons["game-poet"].isEnabled, "games that are not built yet open nothing")
        app.buttons["allGames"].tap()
        XCTAssertTrue(app.buttons["catalog-daily"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'catalog-'")).count, 9)
        app.buttons["back"].tap()
        XCTAssertTrue(app.buttons["dailyOpen"].waitForExistence(timeout: 5))
    }

    /// The keys can be typed and erased; the bulb gives every letter, so the puzzle is won on the first try.
    @MainActor func testTheDailyPuzzleCanBePlayedToAWin() {
        let app = launch(["-beytTab", "games"])
        app.buttons["dailyOpen"].tap()
        XCTAssertTrue(app.buttons["submit"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["submit"].isEnabled, "an empty row can't be submitted")

        let keys = buttons(app, startingWith: "key-")
        XCTAssertGreaterThanOrEqual(keys.count, 12)
        keys.element(boundBy: 0).tap()
        keys.element(boundBy: 1).tap()
        XCTAssertFalse(app.buttons["submit"].isEnabled)
        app.buttons["erase"].tap()
        app.buttons["erase"].tap()

        var hints = 0
        while app.buttons["hint"].isEnabled, hints < 6 {
            app.buttons["hint"].tap()
            hints += 1
        }
        XCTAssertGreaterThanOrEqual(hints, 3)
        XCTAssertTrue(app.buttons["submit"].isEnabled, "every letter was given")
        app.buttons["submit"].tap()

        XCTAssertTrue(app.staticTexts["verdict"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["verdict"].label, "درست چسبوندی!")
        app.buttons["dailyBack"].tap()

        XCTAssertTrue(app.buttons["dailyOpen"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.buttons["dailyOpen"].label, "ببین", "once solved the card shows the couplet and «ببین»")
        XCTAssertTrue(app.staticTexts["dailySolved"].exists || app.otherElements["dailySolved"].exists)
        app.buttons["dailyOpen"].tap()
        XCTAssertTrue(app.staticTexts["verdict"].waitForExistence(timeout: 5), "«ببین» opens the finished puzzle")
    }

    /// Tapping a sticker and then a slot places it; checking shows the sheet; «بیت بعدی» goes on.
    @MainActor func testOneJigsawCoupletByTappingStickers() {
        let app = launch(["-beytRoute", "jigsaw"])
        let card = app.descendants(matching: .any)["jigsawCard"]
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        let empty = buttons(app, startingWith: "slot-", value: "خالی")
        let slots = empty.count
        XCTAssertGreaterThanOrEqual(slots, 2)
        XCTAssertFalse(app.buttons["jigsawCheck"].isEnabled)

        let first = buttons(app, startingWith: "sticker-").element(boundBy: 0)
        let word = first.label
        first.tap()
        empty.element(boundBy: 0).tap()
        XCTAssertEqual(empty.count, slots - 1)
        XCTAssertTrue(buttons(app, startingWith: "slot-", value: word).count >= 1, "the sticker sits in the slot")

        for _ in 1..<slots {
            buttons(app, startingWith: "sticker-").element(boundBy: 0).tap()
            empty.element(boundBy: 0).tap()
        }
        XCTAssertEqual(empty.count, 0)
        XCTAssertTrue(app.buttons["jigsawCheck"].isEnabled)
        app.buttons["jigsawCheck"].tap()

        XCTAssertTrue(app.buttons["jigsawNext"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["verdict"].exists)
        app.buttons["jigsawNext"].tap()
        let progress = app.otherElements["progress"]
        expectation(for: NSPredicate(format: "label CONTAINS %@", "۲"), evaluatedWith: progress)
        waitForExpectations(timeout: 5)
        XCTAssertGreaterThanOrEqual(empty.count, 2, "the next couplet starts with empty slots")
    }

    @MainActor func testAStickerCanBeDraggedToASlot() {
        let app = launch(["-beytRoute", "jigsaw"])
        XCTAssertTrue(app.descendants(matching: .any)["jigsawCard"].waitForExistence(timeout: 10))
        let empty = buttons(app, startingWith: "slot-", value: "خالی")
        let slots = empty.count
        let sticker = buttons(app, startingWith: "sticker-").element(boundBy: 0)
        let word = sticker.label
        sticker.press(forDuration: 0.1, thenDragTo: empty.element(boundBy: 0))
        XCTAssertEqual(empty.count, slots - 1)
        XCTAssertTrue(buttons(app, startingWith: "slot-", value: word).count >= 1, "the dragged sticker sits in the slot")
    }

    @MainActor func testTheBulbFillsASlotAndCostsItsPoints() {
        let app = launch(["-beytRoute", "jigsaw"])
        XCTAssertTrue(app.buttons["jigsawHint"].waitForExistence(timeout: 10))
        let before = buttons(app, startingWith: "slot-", value: "خالی").count
        app.buttons["jigsawHint"].tap()
        XCTAssertEqual(buttons(app, startingWith: "slot-", value: "خالی").count, before - 1)
    }

    @MainActor func testTheEndOfTheRoundShowsTheScoreAndTheCoupletsWhichOpenTheReader() {
        let app = launch(["-beytRoute", "round-end"])
        XCTAssertTrue(app.descendants(matching: .any)["roundEnd"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["تموم شد!"].exists)
        let score = app.descendants(matching: .any)["roundEndScore"]
        XCTAssertTrue(score.label.contains("۸") && score.label.contains("۱۰"), score.label)
        let rows = buttons(app, startingWith: "roundCouplet-")
        XCTAssertGreaterThanOrEqual(rows.count, 5)
        rows.element(boundBy: 0).tap()
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
    }

    @MainActor func testTheReaderStartsJigsawWithThePoem() {
        let app = launch(["-beytRoute", "poem:/hafez/ghazal/sh3"])
        XCTAssertTrue(app.staticTexts["readerTitle"].waitForExistence(timeout: 10))
        app.buttons["بازی با این غزل"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["jigsawCard"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["readerTitle"].exists, "the reader is closed")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'اگر آن'")).firstMatch.exists, "the first couplet of the poem comes first")
    }
}
