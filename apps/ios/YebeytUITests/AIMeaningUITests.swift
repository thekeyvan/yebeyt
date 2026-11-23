import XCTest

/// The sparkle by the meaning's heading: only on AI-written meanings; tapping it says so.
@MainActor
final class AIMeaningUITests: XCTestCase {
    private func launchReader(couplet: Int, poem: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytRoute", "poem:\(poem)", "-beytCouplet", "\(couplet)", "-beytMeaning", "1"]
        app.launch()
        return app
    }

    func testTheReaderMeaningCardShowsTheSparkleOnAnAIMeaningAndTappingItExplains() {
        let app = launchReader(couplet: 0, poem: "/hafez/ghazal/sh17")
        let sparkle = app.buttons["aiSparkle"]
        XCTAssertTrue(sparkle.waitForExistence(timeout: 10))
        XCTAssertEqual(sparkle.label, "با کمک هوش مصنوعی")
        sparkle.tap()
        XCTAssertTrue(app.staticTexts["این معنی با کمک هوش مصنوعی نوشته شده"].waitForExistence(timeout: 3))
    }

    /// The jigsaw of a poem starts with its first couplet; the first couplet of غزل ۱۷ has an AI-written meaning.
    func testTheAfterAnswerSheetShowsTheSparkleOnAnAIMeaningAndTappingItExplains() {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytRoute", "poem:/hafez/ghazal/sh17"]
        app.launch()
        XCTAssertTrue(app.buttons["بازی با این غزل"].waitForExistence(timeout: 10))
        app.buttons["بازی با این غزل"].tap()
        XCTAssertTrue(app.buttons["jigsawHint"].waitForExistence(timeout: 10))
        while app.buttons["jigsawHint"].isEnabled { app.buttons["jigsawHint"].tap() }
        app.buttons["jigsawCheck"].tap()
        let sparkle = app.buttons["aiSparkle"]
        XCTAssertTrue(sparkle.waitForExistence(timeout: 5))
        XCTAssertEqual(sparkle.label, "با کمک هوش مصنوعی")
        XCTAssertGreaterThanOrEqual(sparkle.frame.width, 44)
        XCTAssertGreaterThanOrEqual(sparkle.frame.height, 44)
        sparkle.tap()
        XCTAssertTrue(app.staticTexts["این معنی با کمک هوش مصنوعی نوشته شده"].waitForExistence(timeout: 3))
    }

    func testAMeaningNotWrittenByAnAIHasNoSparkle() {
        let app = launchReader(couplet: 0, poem: "/hafez/ghazal/sh3")
        XCTAssertTrue(app.staticTexts["معنی"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["aiSparkle"].exists)
    }
}
