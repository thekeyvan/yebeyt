import Testing
@testable import Yebeyt

@MainActor
@Suite("Segment paging")
struct SegmentPagingTests {
    @Test func theDirectionIsKnownFromTheAnnouncementOnSoThePageThatLeavesCanGoTheOtherWay() {
        let paging = SegmentPaging()
        #expect(paging.incoming(.full) == Motion.Arrival(dy: 0, scale: 1))  // nothing has been announced
        paging.announce(1, from: 0)
        #expect(paging.incoming(.full).dx == 40)
        #expect(paging.outgoing(.full).dx == -40)
    }

    @Test func theDirectionStaysAfterTheSwitchForThePagesThatAreStillMoving() {
        let paging = SegmentPaging()
        paging.announce(2, from: 0)
        // The switch itself changes nothing here: the pages read the direction until the next tap.
        #expect(paging.incoming(.full).dx == 40)
        #expect(paging.outgoing(.full).dx == -40)
        paging.announce(0, from: 2)
        #expect(paging.incoming(.full).dx == -40)
    }

    @Test func goingBackToAnEarlierSegmentTurnsBothAround() {
        let paging = SegmentPaging()
        paging.announce(1, from: 2)
        #expect(paging.incoming(.full).dx == -40)
        #expect(paging.outgoing(.full).dx == 40)
    }

    @Test func tappingTheOpenSegmentMovesNothing() {
        let paging = SegmentPaging()
        paging.announce(1, from: 1)
        #expect(paging.incoming(.full) == Motion.Arrival(dy: 0, scale: 1))
        #expect(paging.outgoing(.full) == Motion.Arrival(dy: 0, scale: 1))
    }

    @Test func underReduceMotionNothingSlides() {
        let paging = SegmentPaging()
        paging.announce(1, from: 0)
        #expect(paging.incoming(.reduced) == Motion.Arrival(dy: 0, scale: 1))
        #expect(paging.outgoing(.reduced) == Motion.Arrival(dy: 0, scale: 1))
    }
}
