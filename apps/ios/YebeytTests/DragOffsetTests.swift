import SwiftUI
import Testing
@testable import Yebeyt

struct DragOffsetTests {
    @Test func leftToRightFollowsTheFingerAsIs() {
        #expect(DragOffset.offset(for: CGSize(width: -30, height: 12), in: .leftToRight) == CGSize(width: -30, height: 12))
    }

    /// `.offset` mirrors x in a right-to-left layout and a drag's translation does not, so x is turned around.
    @Test func rightToLeftTurnsOnlyTheHorizontalAround() {
        #expect(DragOffset.offset(for: CGSize(width: -30, height: 12), in: .rightToLeft) == CGSize(width: 30, height: 12))
        #expect(DragOffset.offset(for: CGSize(width: 18, height: -5), in: .rightToLeft) == CGSize(width: -18, height: -5))
    }

    @Test func noMovementStaysPut() {
        #expect(DragOffset.offset(for: .zero, in: .rightToLeft) == .zero)
    }
}
