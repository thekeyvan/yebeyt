import Foundation
import Testing
@testable import Yebeyt

@Suite("Motion")
struct MotionTests {
    @Test func reduceMotionPicksTheReducedVariant() {
        #expect(Motion.variant(reduceMotion: false) == .full)
        #expect(Motion.variant(reduceMotion: true) == .reduced)
    }

    @Test func theFullPopOvershootsAndSettlesInAboutHalfASecond() {
        let pop = Motion.Pop.turningOn(.full)
        #expect(pop.scales.map(\.value) == [1.35, 0.9, 1.05, 1])
        #expect(abs(pop.duration - 0.45) < 0.001)
        #expect(pop.rotations.map(\.value).max() == 8)
        #expect(pop.rotations.map(\.value).min() == -8)
        #expect(pop.rotations.last?.value == 0)
    }

    @Test func theRotationWiggleIsOptionalPerPop() {
        #expect(Motion.Pop.turningOn(.full, wiggle: false).rotations.isEmpty)
    }

    @Test func theReducedPopIsAShortScaleWithoutWiggle() {
        for pop in [Motion.Pop.turningOn(.reduced, wiggle: true), .turningOff(.reduced)] {
            #expect(pop.scales.map(\.value) == [1.05, 1])
            #expect(pop.rotations.isEmpty)
            #expect(pop.duration <= 0.25)
        }
    }

    @Test func takingAMarkOffPopsSmallerAndShorter() {
        let off = Motion.Pop.turningOff(.full)
        let on = Motion.Pop.turningOn(.full)
        #expect((off.scales.map(\.value).max() ?? 0) < (on.scales.map(\.value).max() ?? 0))
        #expect(off.duration < on.duration)
        #expect(off.rotations.isEmpty)
    }

    @Test func onlyTheFullVariantBursts() {
        #expect(Motion.bursts(.full))
        #expect(!Motion.bursts(.reduced))
    }

    @Test func everyMotionStaysWithinHalfASecond() {
        #expect(Motion.Pop.turningOn(.full, wiggle: true).duration <= 0.5)
        #expect(Motion.burstDuration <= 0.6)
        #expect(Motion.pressedScale == 0.92)
    }

    @Test func theWrongAnswerShakeIsStrongShortAndEndsStill() {
        #expect(Motion.shake.reduce(0) { $0 + $1.duration } <= 0.5)
        #expect(Motion.shake.map(\.value).max() ?? 0 > 9)
        #expect(Motion.shake.last?.value == 0)
    }

    // MARK: Burst

    @Test func theSameSeedMakesTheSameBurst() {
        #expect(Burst.pieces(.small, seed: 7) == Burst.pieces(.small, seed: 7))
        #expect(Burst.pieces(.small, seed: 7) != Burst.pieces(.small, seed: 8))
    }

    @Test func aBurstHasSixToEightPlainPiecesWithinItsRadius() {
        for style in [Burst.Style.small, .big] {
            for seed in UInt64(0)..<20 {
                let pieces = Burst.pieces(style, seed: seed)
                #expect((6...8).contains(pieces.count))
                #expect(pieces.allSatisfy { $0.distance <= style.radius && $0.distance >= style.radius * 0.6 })
                #expect(Set(pieces.map(\.kind)).isSubset(of: [.dot, .dash, .square]))
            }
        }
        #expect(Burst.Style.big.radius > Burst.Style.small.radius)
    }

    @Test func theAnglesSpreadAroundTheControl() {
        let pieces = Burst.pieces(.small, seed: 3)
        let sectors = Set(pieces.map { Int(($0.angle / (2 * .pi)).truncatingRemainder(dividingBy: 1) * 4) })
        #expect(sectors.count == 4)
    }

    @Test func aPieceStartsAndEndsInvisibleAndFliesOutward() {
        let piece = Burst.pieces(.small, seed: 1)[0]
        #expect(Burst.Frame(piece, progress: 0).opacity == 0)
        #expect(Burst.Frame(piece, progress: 1).opacity == 0)
        let early = Burst.Frame(piece, progress: 0.2), late = Burst.Frame(piece, progress: 0.8)
        #expect(early.opacity > 0)
        #expect(hypot(late.dx, late.dy) > hypot(early.dx, early.dy))
        #expect(hypot(Burst.Frame(piece, progress: 0.999).dx, Burst.Frame(piece, progress: 0.999).dy) <= piece.distance + 0.01)
    }

    @Test func countingUpEndsOnTheValue() {
        #expect(CountUp.text(0) == "۰")
        #expect(CountUp.text(359.6) == "۳۶۰")
    }
}
