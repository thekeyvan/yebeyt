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
        #expect(Motion.pressedScale(.full) == 0.92)
    }

    @Test func theWrongAnswerShakeIsStrongShortAndEndsStill() {
        let shake = Motion.shake(.full)
        #expect(shake.reduce(0) { $0 + $1.duration } <= 0.5)
        #expect(shake.map(\.value).max() ?? 0 > 9)
        #expect(shake.last?.value == 0)
    }

    // MARK: Reduce Motion picks the values

    @Test func reduceMotionDoesNotShakeSquishHardOrThrow() {
        #expect(Motion.shake(.reduced).allSatisfy { $0.value == 0 })
        #expect(Motion.pressedScale(.reduced) == 0.97)
        #expect(Motion.pressAnimation(.reduced) != Motion.pressAnimation(.full))
        #expect(Motion.ThrowPose.thrown(.full).dx != 0 && Motion.ThrowPose.thrown(.full).rotation != 0 && Motion.ThrowPose.thrown(.full).opacity == 1)
        #expect(Motion.ThrowPose.thrown(.reduced) == Motion.ThrowPose(rotation: 0, dx: 0, dy: 0, opacity: 0))
        #expect(Motion.ThrowPose.resting == Motion.ThrowPose(rotation: 0, dx: 0, dy: 0, opacity: 1))
    }

    @Test func toastsAndDealtCardsOnlyFadeUnderReduceMotion() {
        #expect(Motion.toastArrival(.full) == Motion.Arrival(dy: -28, scale: 0.9))
        #expect(Motion.toastArrival(.reduced) == Motion.Arrival(dy: 0, scale: 1))
        #expect(Motion.dealArrival(.full) == Motion.Arrival(dy: 0, scale: 0.8))
        #expect(Motion.dealArrival(.reduced) == Motion.Arrival(dy: 0, scale: 1))
    }

    @Test func countingUpJumpsUnderReduceMotion() {
        #expect(Motion.countUp(.full) != nil)
        #expect(Motion.countUp(.reduced) == nil)
    }

    // MARK: A like or a keep

    @Test func aTappedMarkBurstsAndTapsOnlyWhenItTurnsOn() {
        let on = Motion.markOutcome(turnedOn: true, tapped: true, variant: .full)
        #expect(on.burst && on.haptic)
        #expect(on.pop == .turningOn(.full))
        let off = Motion.markOutcome(turnedOn: false, tapped: true, variant: .full)
        #expect(!off.burst && !off.haptic)
        #expect(off.pop == .turningOff(.full))
    }

    @Test func aStateChangeWithoutATapOnlyPopsSmall() {
        for turnedOn in [true, false] {
            let outcome = Motion.markOutcome(turnedOn: turnedOn, tapped: false, variant: .full)
            #expect(!outcome.burst && !outcome.haptic)
            #expect(outcome.pop == .turningOff(.full))
        }
    }

    @Test func aChangeCountsAsTheTapsForAMomentOnly() {
        let now = Date.now
        #expect(Motion.isOwnTap(lastTapAt: now.addingTimeInterval(-0.3), now: now))
        #expect(!Motion.isOwnTap(lastTapAt: now.addingTimeInterval(-5), now: now))
        #expect(!Motion.isOwnTap(lastTapAt: nil, now: now))
    }

    @Test func reduceMotionKeepsTheTapButNotTheBurst() {
        let outcome = Motion.markOutcome(turnedOn: true, tapped: true, variant: .reduced)
        #expect(!outcome.burst && outcome.haptic)
    }

    // MARK: Celebrating a round

    @Test func aRoundIsCelebratedWhenWonOrAtLeastHalfRight() {
        func summary(right: Int, total: Int = 10, won: Bool? = nil) -> RoundSummary {
            RoundSummary(points: 0, right: right, total: total, subtitle: "", rows: [], won: won)
        }
        #expect(summary(right: 5).celebrates)
        #expect(!summary(right: 4).celebrates)
        #expect(summary(right: 0, won: true).celebrates)
        #expect(!summary(right: 9, won: false).celebrates)
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
