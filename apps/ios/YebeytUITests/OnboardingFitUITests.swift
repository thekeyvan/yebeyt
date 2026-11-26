import XCTest

/// Every onboarding step fits the screen at the default text size on every phone, the small iPhone SE (375×667)
/// included: the control at the top (skip, back, «از قبل حساب داری؟») is under the status bar, not in it, and the main
/// button is fully on screen. At a larger text size the content scrolls (the top control and the main button stay)
/// instead of being cut off.
final class OnboardingFitUITests: XCTestCase {
    private struct Step {
        let name: String
        /// The control at the top, or the first field when the step has none.
        let top: String
        /// Everything at the bottom that must be whole and tappable.
        let bottom: [String]
        var arguments: [String] = []
        /// What stays at the bottom at a large text size, when that is less than `bottom`.
        var pinnedWhenLarge: [String]?
    }

    private let steps = [
        Step(name: "welcome", top: "onbHaveAccount", bottom: ["onbStart"]),
        Step(name: "taste", top: "onbSkip", bottom: ["onbNext"]),
        Step(name: "game", top: "onbSkip", bottom: ["onbCheck"]),
        Step(name: "account", top: "onbSkip", bottom: ["signInApple", "signInGoogle", "onbNoAccount"], pinnedWhenLarge: ["signInApple", "signInGoogle"]),
        Step(name: "username", top: "displayName", bottom: ["usernameDone"], arguments: ["-beytSignedIn", "1"]),
        Step(name: "friends", top: "onbLater", bottom: ["onbHome"], arguments: ["-beytSignedIn", "1"]),
    ]

    @MainActor private func launch(_ step: Step, _ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        // The address is never reached: nothing here signs in for real.
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9", "-beytOnboarding", step.name] + step.arguments + extra
        app.launch()
        XCTAssertTrue(app.buttons[step.bottom[0]].waitForExistence(timeout: 10), "\(step.name) opens")
        return app
    }

    /// The top control is below the status bar and can be tapped; the bottom buttons end on the screen and can be tapped.
    @MainActor private func assertFits(_ step: Step, _ app: XCUIApplication, large: Bool = false, file: StaticString = #filePath, line: UInt = #line) {
        let screen = app.windows.firstMatch.frame
        // The status bar is not in the accessibility tree: 20 pt on the home-button phones, at least 44 on the others.
        let statusBar: CGFloat = screen.height <= 667 ? 20 : 44
        let top = app.descendants(matching: .any)[step.top]
        XCTAssertTrue(top.exists, "\(step.name): \(step.top)", file: file, line: line)
        XCTAssertGreaterThanOrEqual(top.frame.minY, statusBar, "\(step.name): \(step.top) is below the status bar (\(statusBar)): \(top.frame)", file: file, line: line)
        XCTAssertTrue(top.isHittable, "\(step.name): \(step.top) can be tapped", file: file, line: line)
        if step.top != "displayName" {
            XCTAssertGreaterThanOrEqual(top.frame.height, 44, "\(step.name): \(step.top) is 44 pt to touch: \(top.frame)", file: file, line: line)
        }
        for identifier in (large ? step.pinnedWhenLarge : nil) ?? step.bottom {
            let button = app.buttons[identifier]
            XCTAssertTrue(button.exists, "\(step.name): \(identifier)", file: file, line: line)
            XCTAssertLessThanOrEqual(button.frame.maxY, screen.maxY, "\(step.name): \(identifier) ends on the screen: \(button.frame)", file: file, line: line)
            XCTAssertGreaterThanOrEqual(button.frame.minX, 0, "\(step.name): \(identifier)", file: file, line: line)
            XCTAssertLessThanOrEqual(button.frame.maxX, screen.maxX, "\(step.name): \(identifier)", file: file, line: line)
            XCTAssertTrue(button.isHittable, "\(step.name): \(identifier) can be tapped", file: file, line: line)
            if identifier == "onbNoAccount" {
                XCTAssertGreaterThanOrEqual(button.frame.height, 44, "\(step.name): \(identifier) is 44 pt to touch", file: file, line: line)
            }
        }
    }

    @MainActor func testEveryStepFitsAtTheDefaultTextSize() {
        for step in steps {
            let app = launch(step)
            assertFits(step, app)
            app.terminate()
        }
    }

    /// The couplet of the game is drawn at random, and its sticker sheet is taller or shorter with it.
    @MainActor func testTheGameStepFitsWhicheverCoupletComesUp() {
        for _ in 0..<6 {
            let app = launch(steps[2])
            assertFits(steps[2], app)
            let sheet = app.descendants(matching: .any)["onbProgress"]
            XCTAssertLessThanOrEqual(sheet.frame.maxY, app.buttons["onbCheck"].frame.minY, "the game is above the button")
            app.terminate()
        }
    }

    @MainActor func testTheTasteStepShowsAllItsMoodsWithoutScrolling() {
        let app = launch(steps[1])
        let screen = app.windows.firstMatch.frame
        let next = app.buttons["onbNext"].frame
        for mood in ["love", "nature"] {
            let chip = app.buttons["mood-\(mood)"]
            XCTAssertTrue(chip.isHittable, mood)
            XCTAssertLessThanOrEqual(chip.frame.maxY, next.minY, "\(mood) is above the button: \(chip.frame) \(next)")
        }
        let lastPoet = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'poet-'")).element(boundBy: 8)
        XCTAssertTrue(lastPoet.isHittable, "the ninth poet")
        XCTAssertLessThanOrEqual(lastPoet.frame.maxY, next.minY, "the grid is above the button")
        XCTAssertLessThanOrEqual(next.maxY, screen.maxY)
    }

    @MainActor func testEveryStepKeepsItsTopControlAndMainButtonAtLargeTextSizes() {
        for size in ["UICTContentSizeCategoryExtraExtraLarge", "UICTContentSizeCategoryAccessibilityXL"] {
            for step in steps {
                let app = launch(step, ["-UIPreferredContentSizeCategoryName", size])
                assertFits(step, app, large: true)
                app.terminate()
            }
        }
    }

    @MainActor func testTheWelcomeStepDoesNotScrollAtTheDefaultTextSize() {
        let app = launch(steps[0])
        let title = app.staticTexts["یه بیت"]
        XCTAssertTrue(title.exists)
        let before = title.frame
        app.swipeUp()
        XCTAssertEqual(title.frame, before, "the title did not move")
    }

    @MainActor func testTheAccountStepScrollsToItsLaterButtonAtALargeTextSize() {
        let app = launch(steps[3], ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryExtraExtraLarge"])
        let later = app.buttons["onbNoAccount"]
        XCTAssertTrue(later.waitForExistence(timeout: 5))
        for _ in 0..<6 where !later.isHittable { app.swipeUp() }
        XCTAssertTrue(later.isHittable, "the later button can be scrolled to")
        assertFits(steps[3], app, large: true)
    }

    @MainActor func testTheTasteStepScrollsToItsLastMoodAtALargeTextSize() {
        let app = launch(steps[1], ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXL"])
        let last = app.buttons["mood-nature"]
        XCTAssertTrue(last.waitForExistence(timeout: 5))
        for _ in 0..<6 where !last.isHittable { app.swipeUp() }
        XCTAssertTrue(last.isHittable, "the last mood can be scrolled to")
        assertFits(steps[1], app, large: true)
    }
}
