import SwiftUI
import Testing
@testable import Yebeyt

struct SVGShapeTests {
    private func bounds(_ d: String, size: CGFloat = 24) -> CGRect {
        SVGShape(d: d).path(in: CGRect(x: 0, y: 0, width: size, height: size)).boundingRect
    }

    private func expectClose(_ a: CGRect, _ b: CGRect, tolerance: CGFloat = 0.01) {
        #expect(abs(a.minX - b.minX) < tolerance && abs(a.minY - b.minY) < tolerance)
        #expect(abs(a.maxX - b.maxX) < tolerance && abs(a.maxY - b.maxY) < tolerance)
    }

    @Test func linesAbsoluteAndRelative() {
        expectClose(bounds("M2 3L10 3L10 9z"), CGRect(x: 2, y: 3, width: 8, height: 6))
        expectClose(bounds("M2 3h8v6z"), CGRect(x: 2, y: 3, width: 8, height: 6))
        expectClose(bounds("M2 3H10V9"), CGRect(x: 2, y: 3, width: 8, height: 6))
    }

    @Test func numbersRunTogetherLikeInTheIconPaths() {
        // «M8.5 3.5v4M15.5 3.5v4»: two vertical strokes
        expectClose(bounds("M8.5 3.5v4M15.5 3.5v4"), CGRect(x: 8.5, y: 3.5, width: 7, height: 4))
        // «.8» after «8.5» and «-1.4» after «2.8» each start a number: the curve ends at (3.5 + 8.5, 6.8 + 0.8)
        let end = SVGShape(d: "M3.5 6.8c2.8-1.4 5.6-1.1 8.5.8").path(in: CGRect(x: 0, y: 0, width: 24, height: 24)).currentPoint
        #expect(abs((end?.x ?? 0) - 12) < 0.001 && abs((end?.y ?? 0) - 7.6) < 0.001)
    }

    @Test func aSecondPairAfterMoveIsALine() {
        expectClose(bounds("M1 1 5 1 5 4"), CGRect(x: 1, y: 1, width: 4, height: 3))
    }

    @Test func aCircularArcPassesThroughTheRightSide() {
        // upper half circle of radius 10 from (2,12) to (22,12), sweeping clockwise on screen: it rises to y = 2
        expectClose(bounds("M2 12A10 10 0 0 1 22 12"), CGRect(x: 2, y: 2, width: 20, height: 10))
        // sweep 0 goes the other way, under the chord
        expectClose(bounds("M2 12A10 10 0 0 0 22 12"), CGRect(x: 2, y: 12, width: 20, height: 10))
    }

    @Test func theLargeArcFlagTakesTheLongWay() {
        // from (12,5) to (12,21) with r = 8: a half circle either side; large with sweep 1 is the same half here,
        // so test a chord shorter than the diameter: the big part of the circle reaches past the chord
        let small = bounds("M7 12A5 5 0 0 1 17 12").height
        let large = bounds("M9 12A5 5 0 1 1 15 12")
        #expect(abs(small - 5) < 0.01)
        #expect(large.height > 7.9)  // more than half of a circle of radius 5 centred 4 above the chord
    }

    @Test func theBoxScalesToTheFrame() {
        expectClose(bounds("M0 0L24 24", size: 48), CGRect(x: 0, y: 0, width: 48, height: 48))
    }

    @Test func everyGameGlyphHasShapesInsideTheBox() {
        for kind in GameKind.allCases {
            let parts = GameGlyph.parts(for: kind)
            #expect(!parts.isEmpty)
            for case .path(let d) in parts.map(\.shape) {
                let box = bounds(d)
                #expect(box.minX > -1 && box.minY > -1 && box.maxX < 25 && box.maxY < 25, "\(kind) \(d)")
            }
        }
    }
}
