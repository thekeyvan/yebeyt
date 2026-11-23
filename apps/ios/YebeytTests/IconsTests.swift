import SwiftUI
import Testing
@testable import Yebeyt

struct IconsTests {
    @Test func iconsAreNeverMirrored() {
        #expect(HomeIcon().layoutDirectionBehavior == .fixed)
        #expect(ExploreIcon().layoutDirectionBehavior == .fixed)
        #expect(GamesIcon().layoutDirectionBehavior == .fixed)
        #expect(MessagesIcon().layoutDirectionBehavior == .fixed)
        #expect(PersonIcon().layoutDirectionBehavior == .fixed)
        #expect(FlameShape().layoutDirectionBehavior == .fixed)
        #expect(StarShape().layoutDirectionBehavior == .fixed)
    }
}
