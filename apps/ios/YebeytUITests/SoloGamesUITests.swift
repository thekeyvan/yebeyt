import XCTest

/// One question of each of the other solo games, answered by tapping. گوش کن uses canned recitations (`-beytStub 1`):
/// the simulator can't reach api.ganjoor.net.
@MainActor
final class SoloGamesUITests: XCTestCase {
    private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytToday", "2026-11-23"] + arguments
        app.launch()
        return app
    }

    /// An element of any kind by its identifier (a container or a combined label is not always an «other» element).
    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func options(_ app: XCUIApplication) -> XCUIElementQuery {
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'option-'"))
    }

    private func expectProgress(_ app: XCUIApplication, contains digit: String) {
        expectation(for: NSPredicate(format: "label CONTAINS %@", digit), evaluatedWith: element(app, "progress"))
        waitForExpectations(timeout: 5)
    }

    /// Chooses the first option, confirms, checks the sheet and goes on to the next question.
    @MainActor private func answerOneQuestion(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let option = app.buttons["option-0"]
        XCTAssertTrue(option.waitForExistence(timeout: 10), file: file, line: line)
        XCTAssertFalse(app.buttons["quizConfirm"].isEnabled, "nothing is chosen yet", file: file, line: line)
        option.tap()
        XCTAssertTrue(app.buttons["quizConfirm"].isEnabled, file: file, line: line)
        app.buttons["quizConfirm"].tap()
        XCTAssertTrue(app.staticTexts["verdict"].waitForExistence(timeout: 5), file: file, line: line)
        let verdict = app.staticTexts["verdict"].label
        XCTAssertTrue(verdict.hasPrefix("آره") || verdict.hasPrefix("نه"), verdict, file: file, line: line)
        XCTAssertTrue(app.buttons["sheetPoem"].exists && app.buttons["sheetKeep"].exists && app.buttons["sheetSend"].exists, file: file, line: line)
        app.buttons["quizNext"].tap()
        expectProgress(app, contains: "۲")
    }

    @MainActor func testPoetGameShowsFourFacesAndAFirstQuestionCanBeAnswered() {
        let app = launch(["-beytRoute", "poet-game"])
        XCTAssertTrue(element(app, "quizCouplet").waitForExistence(timeout: 10))
        XCTAssertEqual(options(app).count, 4)
        XCTAssertTrue(element(app, "timer").exists, "حدس شاعر is timed")
        let progress = element(app, "progress").label
        XCTAssertTrue(progress.contains("۱") && progress.contains("۱۰"), progress)
        answerOneQuestion(app)
    }

    @MainActor func testFiftyFiftyTakesTwoOptionsAwayOnceAndNeverTheRightOne() {
        let app = launch(["-beytRoute", "poet-game"])
        XCTAssertTrue(app.buttons["fifty"].waitForExistence(timeout: 10))
        app.buttons["fifty"].tap()
        XCTAssertFalse(app.buttons["fifty"].isEnabled)
        let left = options(app).allElementsBoundByIndex.filter { $0.isHittable }
        XCTAssertEqual(left.count, 2)
        left[0].tap()
        app.buttons["quizConfirm"].tap()
        XCTAssertTrue(app.staticTexts["verdict"].waitForExistence(timeout: 5))
    }

    @MainActor func testSkipPassesAQuestionWithoutASheetOrPoints() {
        let app = launch(["-beytRoute", "poet-game"])
        XCTAssertTrue(app.buttons["quizSkip"].waitForExistence(timeout: 10))
        app.buttons["quizSkip"].tap()
        expectProgress(app, contains: "۲")
        XCTAssertFalse(app.staticTexts["verdict"].exists, "a skipped question has no sheet")
        XCTAssertEqual(element(app, "score").label, "+۰")
        XCTAssertTrue(app.buttons["quizSkip"].isEnabled && app.buttons["quizConfirm"].exists)
    }

    @MainActor func testSecondHemistichHasThreeOptionsAndARoundClock() {
        let app = launch(["-beytRoute", "second"])
        XCTAssertTrue(element(app, "quizCouplet").waitForExistence(timeout: 10))
        XCTAssertEqual(options(app).count, 3)
        let time = element(app, "timer").value as? String ?? ""
        XCTAssertTrue(time == "۲:۰۰" || time.hasPrefix("۱:۵"), "the round has two minutes: \(time)")
        answerOneQuestion(app)
    }

    @MainActor func testBookGameShowsBooksOfThePoet() {
        let app = launch(["-beytRoute", "book-game"])
        XCTAssertTrue(element(app, "quizCouplet").waitForExistence(timeout: 10))
        let books = options(app).count
        XCTAssertTrue(books == 2 || books == 3, "\(books) books")
        XCTAssertFalse(app.buttons["fifty"].exists, "the book game has no ۵۰:۵۰")
        XCTAssertFalse(app.buttons["quizSkip"].exists, "and no skip")
        answerOneQuestion(app)
    }

    @MainActor func testListenHidesTheTextAndHasNoClock() {
        let app = launch(["-beytRoute", "listen", "-beytStub", "1"])
        XCTAssertTrue(element(app, "listenCard").waitForExistence(timeout: 20))
        XCTAssertFalse(element(app, "timer").exists, "گوش کن has no clock")
        XCTAssertFalse(element(app, "quizCouplet").exists, "the text is hidden")
        XCTAssertTrue(app.buttons["listenReplay"].label.contains("۱"))
        XCTAssertFalse(app.buttons["listenFromStart"].exists, "replay is «دوباره بشنو» only")
        XCTAssertTrue(app.buttons["quizSkip"].isEnabled, "«رد کن» is in that slot, as on the board")
        XCTAssertEqual(options(app).count, 3)
        XCTAssertTrue(app.buttons["listenWord"].isEnabled)
        app.buttons["listenWord"].tap()
        XCTAssertFalse(app.buttons["listenWord"].isEnabled, "one word for each question")
        app.buttons["option-0"].tap()
        app.buttons["quizConfirm"].tap()
        XCTAssertTrue(app.staticTexts["verdict"].waitForExistence(timeout: 5))
        app.buttons["quizNext"].tap()
        expectProgress(app, contains: "۲")
        XCTAssertTrue(app.buttons["listenWord"].isEnabled, "the next question has its own word")
        app.buttons["quizSkip"].tap()
        expectProgress(app, contains: "۳")
        XCTAssertFalse(app.staticTexts["verdict"].exists, "a skipped question has no sheet")
    }

    private func persian(_ number: Int) -> String {
        String(String(number).map { Character(UnicodeScalar(0x06F0 + Int($0.wholeNumberValue ?? 0))!) })
    }

    /// A wrong meaning only shakes; the right one joins its word; the last pair opens the sheet.
    @MainActor func testMatchAWholeCoupletByTappingWordsThenMeanings() {
        let app = launch(["-beytRoute", "match"])
        XCTAssertTrue(app.buttons["word-0"].waitForExistence(timeout: 10))
        XCTAssertFalse(element(app, "timer").exists, "معنی‌یاب has no clock")
        let words = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'word-'")).count
        XCTAssertGreaterThanOrEqual(words, 2)
        let dots = element(app, "progress").label
        XCTAssertTrue(dots.contains("جفت") && dots.contains(persian(words)), "one dot for each pair: \(dots)")

        app.buttons["meaning-0"].tap()  // no word in hand
        app.buttons["word-0"].tap()
        app.buttons["meaning-1"].tap()  // wrong
        XCTAssertEqual(element(app, "score").label, "+۰")
        app.buttons["meaning-0"].tap()
        XCTAssertEqual(element(app, "score").label, "+۱۰")
        XCTAssertTrue(element(app, "progress").label.contains("۲"), "the second pair is next")

        for id in 1..<words {
            app.buttons["word-\(id)"].tap()
            app.buttons["meaning-\(id)"].tap()
        }
        XCTAssertTrue(app.staticTexts["verdict"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["+" + persian(words * 10)].exists, "the sheet says how many points the couplet gave")
        expectation(for: NSPredicate(format: "isHittable == true"), evaluatedWith: app.buttons["matchNext"])
        waitForExpectations(timeout: 5)  // the sheet slides in
        app.buttons["matchNext"].tap()
        expectProgress(app, contains: "۱")  // the first pair of the next couplet
    }

    @MainActor func testTheTabsFourCardsAndTheCatalogOpenTheirGames() {
        let app = launch(["-beytTab", "games"])
        for kind in ["jigsaw", "poet", "misra", "book"] {
            XCTAssertTrue(app.buttons["game-\(kind)"].waitForExistence(timeout: 10))
            XCTAssertTrue(app.buttons["game-\(kind)"].isEnabled, kind)
        }
        app.buttons["game-misra"].tap()
        XCTAssertTrue(element(app, "quizCouplet").waitForExistence(timeout: 10))
        app.buttons["gameClose"].tap()
        app.buttons["allGames"].tap()
        XCTAssertTrue(app.buttons["catalog-match"].waitForExistence(timeout: 5))
        for kind in ["daily", "jigsaw", "poet", "misra", "book", "match", "listen"] {
            XCTAssertTrue(app.buttons["catalog-\(kind)"].isEnabled, kind)
        }
        XCTAssertTrue(app.buttons["catalog-mosh"].isEnabled && app.buttons["catalog-duel"].isEnabled)
        app.buttons["catalog-match"].tap()
        XCTAssertTrue(app.buttons["word-0"].waitForExistence(timeout: 10))
    }

    @MainActor func testThePoetPageStartsSecondHemistichWithThatPoetOnly() {
        let app = launch(["-beytRoute", "poet:hafez"])
        XCTAssertTrue(app.buttons["gameCard"].waitForExistence(timeout: 10))
        app.buttons["gameCard"].tap()
        XCTAssertTrue(element(app, "quizCouplet").waitForExistence(timeout: 10))
        let label = element(app, "quizCouplet").label
        XCTAssertTrue(label.contains("مصراع دوم"), "the second hemistich is a blank: \(label)")
        XCTAssertTrue(label.contains("حافظ"), "the poet's tag on the couplet: \(label)")
    }
}
