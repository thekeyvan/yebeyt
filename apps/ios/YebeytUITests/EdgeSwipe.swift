import XCTest

extension XCTestCase {
    /// The back swipe: in right-to-left it starts at the right edge, inside the system's edge zone (a few points: 0.995 of
    /// the width is under 2 pt on an iPhone SE), at the height of `row` (a sideways row of chips that reaches the edge, to
    /// check it does not take the swipe) or half way down the screen.
    @MainActor func edgeSwipeBack(_ app: XCUIApplication, atHeightOf row: XCUIElement? = nil) {
        let window = app.windows.firstMatch
        let y = row.map { $0.frame.midY / window.frame.height } ?? 0.5
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: y))
            .press(forDuration: 0.1, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: y)))
    }
}
