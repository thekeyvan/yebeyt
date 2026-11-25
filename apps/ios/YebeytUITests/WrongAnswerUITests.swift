import XCTest

/// A wrong answer looks wrong: what was got wrong turns red, the right answer is written in the sheet, and only what
/// was right earns.
@MainActor
final class WrongAnswerUITests: XCTestCase {
    private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytToday", "2026-11-23"] + arguments
        app.launch()
        return app
    }

    private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func persian(_ number: Int) -> String {
        String(String(number).map { Character(UnicodeScalar(0x06F0 + Int($0.wholeNumberValue ?? 0))!) })
    }

    /// How many pixels of the screen are the red of a wrong answer (fire, #FF4D24; a little darker under the sheet's scrim).
    /// The red behind the sheet is not in the accessibility tree (the sheet is modal), so it is looked for in the screenshot,
    /// drawn first into an sRGB RGBA8 context so the channels are the same whatever the screenshot's own format.
    private func redPixels(_ app: XCUIApplication) -> Int {
        guard let image = app.screenshot().image.cgImage, let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(
                  data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4, space: space,
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              ) else { return 0 }
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        guard let data = context.data else { return 0 }
        let pixels = data.bindMemory(to: UInt8.self, capacity: image.width * image.height * 4)
        var count = 0
        for index in 0..<(image.width * image.height) {
            let (r, g, b) = (Int(pixels[index * 4]), Int(pixels[index * 4 + 1]), Int(pixels[index * 4 + 2]))
            if r > 170, r - g > 100, g < 120, b < 90 { count += 1 }
        }
        return count
    }

    /// One wrong word of a جورچین couplet: it turns red, the sheet says «نه» and writes the right words, and the couplet
    /// earns only for the right ones.
    func testAWrongJigsawCoupletTurnsRedAndTheSheetWritesTheRightWords() {
        let app = launch(["-beytRoute", "jigsaw-wrong"])
        XCTAssertTrue(app.buttons["jigsawCheck"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["jigsawCheck"].isEnabled, "every slot is filled")
        XCTAssertLessThan(redPixels(app), 200, "nothing is red before the check")
        XCTAssertEqual(element(app, "score").label, "+۰")

        app.buttons["jigsawCheck"].tap()
        XCTAssertTrue(app.buttons["jigsawNext"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["verdict"].label, "نه، این بود")
        XCTAssertFalse(element(app, "correction").label.isEmpty, "the right words are written in the sheet")
        // The sheet shows what was stuck: one word wrong (red), the others right, and the right words written out.
        func count(_ kind: String) -> Int { app.descendants(matching: .any).matching(identifier: "attempt-\(kind)").count }
        XCTAssertEqual(count("wrong"), 1)
        let rights = count("right")
        XCTAssertGreaterThanOrEqual(rights, 1)
        XCTAssertEqual(app.descendants(matching: .any)["attempt-wrong"].value as? String, "نشد")
        let detail = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH '+'")).firstMatch
        XCTAssertTrue(detail.exists, "the sheet says what the couplet earned")
        let earned = detail.label.components(separatedBy: " ").first ?? ""
        XCTAssertEqual(earned, "+" + persian(rights * 20), "20 for each right word and nothing for the wrong one, not a full answer's \((rights + 1) * 20)")

        // It counts as a wrong couplet: a red dot, and the couplet's points are the right words only.
        app.buttons["jigsawNext"].tap()
        XCTAssertTrue(element(app, "progress").waitForExistence(timeout: 5))
        XCTAssertGreaterThan(redPixels(app), 200, "the couplet's dot is red")
        XCTAssertEqual(element(app, "score").label, earned, "only the earned points were added")
    }

    /// حدس شاعر, the third answer (the first two are right): the wrong option is red and the right one green, the sheet
    /// names the poet, and the wrong answer adds nothing to the two right ones.
    func testAWrongPoetAnswerTurnsRedAndAddsNothing() {
        let app = launch(["-beytRoute", "poet-game", "-beytPlay", "3", "-beytSheet", "answer"])
        XCTAssertTrue(app.buttons["quizNext"].waitForExistence(timeout: 10))
        let verdict = app.staticTexts["verdict"].label
        XCTAssertTrue(verdict.hasPrefix("نه، "), verdict)
        XCTAssertTrue(app.staticTexts["این یکی رو حساب نکردیم"].exists, "the sheet says it was not counted")
        RunLoop.current.run(until: .now + 0.8)
        XCTAssertGreaterThan(redPixels(app), 200, "the wrong option is red")
        app.buttons["quizNext"].tap()
        XCTAssertTrue(element(app, "progress").waitForExistence(timeout: 5))
        XCTAssertEqual(element(app, "score").label, "+۶۸", "two right answers of 34 and nothing for the wrong one")
    }

    /// مصراع دوم: a wrong answer writes the right second hemistich in the sheet.
    func testAWrongSecondHemistichIsWrittenInTheSheet() {
        let app = launch(["-beytRoute", "second", "-beytPlay", "3", "-beytSheet", "answer"])
        XCTAssertTrue(app.buttons["quizNext"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["verdict"].label, "نه، این بود")
        XCTAssertFalse(element(app, "correction").label.isEmpty, "the right hemistich is written in the sheet")
        app.buttons["quizNext"].tap()
        XCTAssertTrue(element(app, "score").waitForExistence(timeout: 5))
        XCTAssertEqual(element(app, "score").label, "+۶۸")
    }
}
