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

    @Test func readerIconsAreNeverMirrored() {
        #expect(ChevronDownIcon().layoutDirectionBehavior == .fixed)
        #expect(CloseIcon().layoutDirectionBehavior == .fixed)
        #expect(HeartIcon().layoutDirectionBehavior == .fixed)
        #expect(RepostIcon().layoutDirectionBehavior == .fixed)
        #expect(BookmarkIcon().layoutDirectionBehavior == .fixed)
        #expect(BookIcon().layoutDirectionBehavior == .fixed)
        #expect(CoupletFocusIcon().layoutDirectionBehavior == .fixed)
        #expect(CopyIcon().layoutDirectionBehavior == .fixed)
        #expect(PlayIcon().layoutDirectionBehavior == .fixed)
    }

    /// The heart's two lobes bulge up past their end points (y 7.4), as in the board's SVG.
    @Test func theHeartsArcsBulgeTheRightWay() {
        let box = HeartIcon().path(in: CGRect(x: 0, y: 0, width: 24, height: 24)).boundingRect
        #expect(box.minY < 6.5 && box.minY > 4)
        #expect(abs(box.minX - 4.5) < 0.6 && abs(box.maxX - 19.5) < 0.6)
        #expect(abs(box.maxY - 20) < 0.3)
    }

    @Test func theBookmarkAndTheBookFillTheirBoxes() {
        let unit = CGRect(x: 0, y: 0, width: 24, height: 24)
        let bookmark = BookmarkIcon().path(in: unit).boundingRect
        #expect(abs(bookmark.minX - 6) < 0.01 && abs(bookmark.maxX - 18) < 0.01 && abs(bookmark.minY - 3.5) < 0.01 && abs(bookmark.maxY - 20.5) < 0.01)
        let book = BookIcon().path(in: unit).boundingRect
        #expect(abs(book.minX - 4) < 0.01 && abs(book.maxX - 20) < 0.01 && abs(book.minY - 4) < 0.01 && abs(book.maxY - 20) < 0.01)
    }
}
