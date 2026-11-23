import Testing
@testable import Yebeyt

struct CoupletPagingTests {
    @Test func clampKeepsAnIndexInsideTheCouplets() {
        #expect(CoupletPaging.clamp(3, count: 9) == 3)
        #expect(CoupletPaging.clamp(-2, count: 9) == 0)
        #expect(CoupletPaging.clamp(9, count: 9) == 8)
        #expect(CoupletPaging.clamp(40, count: 9) == 8)
        #expect(CoupletPaging.clamp(5, count: 0) == 0)
    }

    @Test func nextAndPreviousStopAtTheEnds() {
        #expect(CoupletPaging.next(from: 1, count: 3) == 2)
        #expect(CoupletPaging.next(from: 2, count: 3) == 2)
        #expect(CoupletPaging.previous(from: 1, count: 3) == 0)
        #expect(CoupletPaging.previous(from: 0, count: 3) == 0)
    }

    @Test func neighboursAreTheNearestHemistichs() {
        let couplets = [
            Couplet(m1: "الف", m2: "ب"), Couplet(m1: "پ", m2: "ت"), Couplet(m1: "ث", m2: "ج"), Couplet(m1: "نثر", m2: ""),
        ]
        #expect(CoupletPaging.above(1, in: couplets) == "ب")
        #expect(CoupletPaging.below(1, in: couplets) == "ث")
        #expect(CoupletPaging.above(0, in: couplets) == nil)
        #expect(CoupletPaging.below(3, in: couplets) == nil)
        // The nearest line above a single-line couplet is its only line.
        #expect(CoupletPaging.above(3, in: couplets) == "ج")
        #expect(CoupletPaging.below(2, in: couplets) == "نثر")
    }

    @Test func nearestToTopIsTheFirstRowStillOnScreen() {
        let rows: [CoupletPaging.Row] = [
            .init(index: 0, minY: -190, maxY: -10),
            .init(index: 1, minY: 10, maxY: 150),
            .init(index: 2, minY: 170, maxY: 310),
        ]
        #expect(CoupletPaging.nearestToTop(rows) == 1)
    }

    @Test func aRowCrossingTheTopCountsWhileItsMiddleIsBelowTheEdge() {
        // The half-hidden first row has more than half on screen, so it is still the one at the top.
        let crossing: [CoupletPaging.Row] = [.init(index: 0, minY: -60, maxY: 80), .init(index: 1, minY: 95, maxY: 235)]
        #expect(CoupletPaging.nearestToTop(crossing) == 0)
        let mostlyHidden: [CoupletPaging.Row] = [.init(index: 0, minY: -110, maxY: 30), .init(index: 1, minY: 45, maxY: 185)]
        #expect(CoupletPaging.nearestToTop(mostlyHidden) == 1)
    }

    @Test func nearestToTopWithNoRowsIsNil() {
        #expect(CoupletPaging.nearestToTop([]) == nil)
    }
}
