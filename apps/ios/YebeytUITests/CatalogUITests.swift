import XCTest

/// The games catalog (GamesCatalog): every game is a card in a grid, three across at the default text size and fewer as it grows.
final class CatalogUITests: XCTestCase {
    @MainActor private func launch(_ category: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-beytFresh", "1", "-beytAPI", "http://127.0.0.1:9", "-beytSignedIn", "1", "-beytRoute", "games-catalog"]
            + (category.map { ["-UIPreferredContentSizeCategoryName", $0] } ?? [])
        app.launch()
        return app
    }

    private let kinds = ["daily", "jigsaw", "poet", "misra", "book", "match", "listen", "mosh", "duel"]

    private func columns(_ app: XCUIApplication) -> [CGFloat] {
        var xs: [CGFloat] = []
        for kind in kinds {
            let x = app.buttons["catalog-\(kind)"].frame.minX.rounded()
            if !xs.contains(where: { abs($0 - x) < 2 }) { xs.append(x) }
        }
        return xs.sorted()
    }

    @MainActor private func shot(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @MainActor func testEveryGameIsACardWithItsNameAndLineAndOpens() {
        let app = launch()
        XCTAssertTrue(app.buttons["catalog-daily"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'catalog-'")).count, kinds.count)
        for kind in kinds {
            let card = app.buttons["catalog-\(kind)"]
            XCTAssertTrue(card.exists, kind)
            XCTAssertGreaterThanOrEqual(card.frame.height, 44, kind)
            XCTAssertGreaterThanOrEqual(card.frame.width, 44, kind)
        }
        let daily = app.buttons["catalog-daily"].label
        XCTAssertTrue(daily.contains("معمای امروز") && daily.contains("روزانه"), "the card says its name and its line: \(daily)")
    }

    /// گوش کن asks Ganjoor for recitations (the stub of `-beytStub` works only with its own route), so here the
    /// game is known to be open by its close button, which the loading screen has too.
    @MainActor func testEachSoloGameOpensFromItsCard() {
        let app = launch()
        let opened: [(String, String)] = [("daily", "submit"), ("jigsaw", "jigsawCheck"), ("poet", "quizCouplet"), ("misra", "quizCouplet"),
                                          ("book", "quizCouplet"), ("match", "word-0"), ("listen", "gameClose")]
        for (kind, mark) in opened {
            let card = app.buttons["catalog-\(kind)"]
            XCTAssertTrue(card.waitForExistence(timeout: 10), kind)
            for _ in 0..<3 where !card.isHittable { app.scrollViews.firstMatch.swipeUp(velocity: .fast) }
            card.tap()
            XCTAssertTrue(app.descendants(matching: .any)[mark].waitForExistence(timeout: 15), "\(kind) did not open")
            if app.buttons["gameClose"].waitForExistence(timeout: 2) { app.buttons["gameClose"].tap() }
            if app.buttons["leaveGameConfirm"].waitForExistence(timeout: 2) { app.buttons["leaveGameConfirm"].tap() }
        }
    }

    @MainActor func testThreeColumnsInRightToLeftOrderAtTheDefaultSize() {
        let app = launch()
        XCTAssertTrue(app.buttons["catalog-daily"].waitForExistence(timeout: 10))
        XCTAssertEqual(columns(app).count, 3)
        let screenWidth = app.windows.firstMatch.frame.width
        for kind in kinds {
            let frame = app.buttons["catalog-\(kind)"].frame
            XCTAssertGreaterThanOrEqual(frame.minX, 0, kind)
            XCTAssertLessThanOrEqual(frame.maxX, screenWidth, kind)
        }
        let daily = app.buttons["catalog-daily"].frame, jigsaw = app.buttons["catalog-jigsaw"].frame, poet = app.buttons["catalog-poet"].frame
        XCTAssertEqual(daily.minY, jigsaw.minY, accuracy: 2)
        XCTAssertGreaterThan(daily.minX, jigsaw.minX, "the first game is on the right")
        XCTAssertGreaterThan(jigsaw.minX, poet.minX)
        XCTAssertGreaterThan(app.buttons["catalog-misra"].frame.minY, daily.maxY - 1, "the next row is below")
        shot(app, "catalog-default")
    }

    /// Every word inside a card (the pictures' labels too) lies within its picture's box, so a narrow phone does not cut any off.
    @MainActor func testNoLabelOfAPictureIsCutOff() {
        let app = launch()
        XCTAssertTrue(app.buttons["catalog-daily"].waitForExistence(timeout: 10))
        var seen = 0
        for kind in kinds {
            let card = app.buttons["catalog-\(kind)"]
            let inside = card.frame.insetBy(dx: 10, dy: 0)  // the picture's box, inside the card's padding
            for text in card.descendants(matching: .staticText).allElementsBoundByIndex where !text.frame.isEmpty {
                seen += 1
                XCTAssertGreaterThanOrEqual(text.frame.minX, inside.minX - 1, "\(kind): «\(text.label)» is cut off on the left")
                XCTAssertLessThanOrEqual(text.frame.maxX, inside.maxX + 1, "\(kind): «\(text.label)» is cut off on the right")
            }
        }
        XCTAssertGreaterThan(seen, 20, "the pictures' labels are found")
        shot(app, "catalog-narrow")
    }

    @MainActor func testFewerColumnsAsTheTextGrows() {
        let medium = launch("UICTContentSizeCategoryXXL")
        XCTAssertTrue(medium.buttons["catalog-daily"].waitForExistence(timeout: 10))
        XCTAssertEqual(columns(medium).count, 2)
        medium.terminate()

        let large = launch("UICTContentSizeCategoryAccessibilityL")
        XCTAssertTrue(large.buttons["catalog-daily"].waitForExistence(timeout: 10))
        XCTAssertEqual(columns(large).count, 1)
        let screenWidth = large.windows.firstMatch.frame.width
        for kind in kinds {
            let frame = large.buttons["catalog-\(kind)"].frame
            XCTAssertGreaterThanOrEqual(frame.minX, 0, kind)
            XCTAssertLessThanOrEqual(frame.maxX, screenWidth, kind)
        }
        shot(large, "catalog-ax-l")
    }
}
