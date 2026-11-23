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

    func testAMeaningNotWrittenByAnAIHasNoSparkle() {
        let app = launchReader(couplet: 0, poem: "/hafez/ghazal/sh3")
        XCTAssertTrue(app.staticTexts["معنی"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["aiSparkle"].exists)
    }
}
