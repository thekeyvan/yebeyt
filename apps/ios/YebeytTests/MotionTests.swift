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
        for action in [Burst.Action.like, .keep, .repost] {
            let on = Motion.markOutcome(action, turnedOn: true, tapped: true, variant: .full)
            #expect(on.burst && on.haptic)
            #expect(on.pop == .turningOn(action, .full))
            let off = Motion.markOutcome(action, turnedOn: false, tapped: true, variant: .full)
            #expect(!off.burst && !off.haptic)
            #expect(off.pop == .turningOff(.full))
        }
    }

    @Test func aStateChangeWithoutATapOnlyPopsSmall() {
        for action in Burst.Action.allCases {
            for turnedOn in [true, false] {
                let outcome = Motion.markOutcome(action, turnedOn: turnedOn, tapped: false, variant: .full)
                #expect(!outcome.burst && !outcome.haptic)
                #expect(outcome.pop == .turningOff(.full))
            }
        }
    }

    @Test func aSendFliesButHasNoParticlesAndNoTap() {
        let outcome = Motion.markOutcome(.send, turnedOn: true, tapped: true, variant: .full)
        #expect(!outcome.burst && !outcome.haptic)
        #expect(outcome.pop == .turningOn(.send, .full))
    }

    @Test func aChangeCountsAsTheTapsForAMomentOnly() {
        let now = Date.now
        #expect(Motion.isOwnTap(lastTapAt: now.addingTimeInterval(-0.3), now: now))
        #expect(!Motion.isOwnTap(lastTapAt: now.addingTimeInterval(-5), now: now))
        #expect(!Motion.isOwnTap(lastTapAt: nil, now: now))
    }

    @Test func reduceMotionKeepsTheTapButNotTheParticles() {
        for action in [Burst.Action.like, .keep, .repost] {
            let outcome = Motion.markOutcome(action, turnedOn: true, tapped: true, variant: .reduced)
            #expect(!outcome.burst && outcome.haptic)
        }
    }

    @Test func eachActionsIconMovesItsOwnWayAndReduceMotionOnlyScales() {
        let drop = Motion.Pop.turningOn(.keep, .full), spin = Motion.Pop.turningOn(.repost, .full), fly = Motion.Pop.turningOn(.send, .full)
        #expect(drop.dys.first?.value ?? 0 < 0 && drop.dys.last?.value == 0)  // from above, to rest
        #expect(spin.rotations.last?.value == 360)
        #expect(fly.dxs.first?.value ?? 0 > 0 && fly.dys.first?.value ?? 0 < 0)  // toward the top corner
        #expect(fly.dxs.last?.value == 0 && fly.dys.last?.value == 0 && fly.opacities.last?.value == 1)  // lands back
        #expect(Motion.Pop.turningOn(.like, .full) == .turningOn(.full))
        for action in Burst.Action.allCases {
            let full = Motion.Pop.turningOn(action, .full), reduced = Motion.Pop.turningOn(action, .reduced)
            #expect(full.duration <= 0.5)
            #expect(reduced.scales.map(\.value) == [1.05, 1])
            #expect(reduced.rotations.isEmpty && reduced.dxs.isEmpty && reduced.dys.isEmpty && reduced.opacities.isEmpty)
        }
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

    @Test func theSameSeedMakesTheSameBurstForEachAction() {
        for action in Burst.Action.allCases where action != .send {
            #expect(Burst.pieces(action, seed: 7) == Burst.pieces(action, seed: 7))
            #expect(Burst.pieces(action, seed: 7) != Burst.pieces(action, seed: 8))
        }
    }

    @Test func eachActionHasItsOwnPiecesInItsOwnCount() {
        let expected: [Burst.Action: (ClosedRange<Int>, Set<Burst.Kind>, Set<Burst.Tint>)] = [
            .like: (4...6, [.heart], [.fire, .magenta]),
            .keep: (3...4, [.ribbon], [.lapis]),
            .repost: (2...2, [.arrow], [.lapis]),
            .send: (0...0, [], []),
            .right: (4...6, [.tick], [.green]),
            .win: (6...8, [.dot, .dash, .square], Set(Burst.Tint.allCases)),
        ]
        for action in Burst.Action.allCases {
            let (count, kinds, tints) = expected[action]!
            for seed in UInt64(0)..<30 {
                let pieces = Burst.pieces(action, seed: seed)
                #expect(count.contains(pieces.count))
                #expect(Set(pieces.map(\.kind)).isSubset(of: kinds))
                #expect(Set(pieces.map(\.tint)).isSubset(of: tints))
                #expect(pieces.allSatisfy { $0.distance <= action.style.radius && $0.distance >= action.style.radius * 0.7 - 0.001 })
            }
        }
        #expect(Burst.pieces(.send, seed: 1).isEmpty)
    }

    @Test func heartsRiseAndRibbonsFanOutUpward() {
        for action in [Burst.Action.like, .keep] {
            for seed in UInt64(0)..<20 {
                #expect(Burst.pieces(action, seed: seed).allSatisfy { sin($0.angle) < -0.3 || sin($0.angle + 2 * .pi) < -0.3 })
            }
        }
        let heart = Burst.pieces(.like, seed: 2)[0]
        #expect(Burst.Frame(heart, progress: 0.6).dy < Burst.Frame(heart, progress: 0.3).dy)  // still going up
    }

    @Test func aWinGetsConfettiAndBigIsBigger() {
        #expect(Burst.Style.big.radius > Burst.Style.small.radius)
        #expect(Burst.pieces(.win, style: .big, seed: 1).allSatisfy { $0.distance <= Burst.Style.big.radius })
    }

    @Test func theAnglesSpreadAroundTheControl() {
        let pieces = Burst.pieces(.win, seed: 3)
        let sectors = Set(pieces.map { Int(($0.angle / (2 * .pi)).truncatingRemainder(dividingBy: 1) * 4) })
        #expect(sectors.count == 4)
    }

    @Test func aPieceStartsAndEndsInvisibleAndFliesOutward() {
        for action in Burst.Action.allCases where action != .send {
            let piece = Burst.pieces(action, seed: 1)[0]
            #expect(Burst.Frame(piece, progress: 0).opacity == 0)
            #expect(Burst.Frame(piece, progress: 1).opacity == 0)
            #expect(Burst.Frame(piece, progress: 0.2).opacity > 0)
        }
        let piece = Burst.pieces(.win, seed: 1)[0]
        let early = Burst.Frame(piece, progress: 0.2), late = Burst.Frame(piece, progress: 0.8)
        #expect(hypot(late.dx, late.dy) > hypot(early.dx, early.dy))
    }

    @Test func countingUpEndsOnTheValue() {
        #expect(CountUp.text(0) == "۰")
        #expect(CountUp.text(359.6) == "۳۶۰")
    }

    // MARK: Sheets, covers, menus, rows, tabs

    @Test func sheetsAndCoversOnlyRiseWithFullMotion() {
        #expect(Motion.rises(.full))
        #expect(!Motion.rises(.reduced))
    }

    @Test func menusAndRowsScaleInFromSmallAndCrossfadeUnderReduceMotion() {
        #expect(Motion.menuArrival(.full) == Motion.Arrival(dy: 0, scale: 0.9))
        #expect(Motion.menuArrival(.reduced) == Motion.Arrival(dy: 0, scale: 1))
        #expect(Motion.rowArrival(.full) == Motion.Arrival(dy: 12, scale: 0.9))
        #expect(Motion.rowArrival(.reduced) == Motion.Arrival(dy: 0, scale: 1))
    }

    @Test func theTabPageSlidesInFromTheSideOfItsTab() {
        // Right-to-left: the first tab (خونه) is at the right, so کاوش is at the left and the page comes from the left.
        #expect(Motion.tabArrival(from: 0, to: 1, rightToLeft: true, .full).dx == -16)
        #expect(Motion.tabArrival(from: 3, to: 1, rightToLeft: true, .full).dx == 16)
        #expect(Motion.tabArrival(from: 0, to: 1, rightToLeft: false, .full).dx == 16)
        #expect(Motion.tabArrival(from: 4, to: 2, rightToLeft: false, .full).dx == -16)
        #expect(Motion.tabArrival(from: 2, to: 2, rightToLeft: true, .full).dx == 0)
    }

    @Test func theTabPageOnlyFadesUnderReduceMotion() {
        #expect(Motion.tabArrival(from: 0, to: 4, rightToLeft: true, .reduced) == Motion.Arrival(dy: 0, scale: 1))
    }

    @Test func tabsAreNumberedInTheBarOrder() {
        #expect(Tab.allCases.map(\.index) == [0, 1, 2, 3, 4])
    }

    // MARK: Drag to dismiss

    @Test func aDragPastAThirdOfTheHeightDismisses() {
        #expect(SheetDrag.shouldDismiss(translation: 130, velocity: 0, height: 400))
        #expect(SheetDrag.shouldDismiss(translation: 120, velocity: 0, height: 400))
        #expect(!SheetDrag.shouldDismiss(translation: 119, velocity: 0, height: 400))
    }

    @Test func aFlickDownDismissesAtAnyDistance() {
        #expect(SheetDrag.shouldDismiss(translation: 20, velocity: 900, height: 400))
        #expect(!SheetDrag.shouldDismiss(translation: 20, velocity: 300, height: 400))
    }

    @Test func aDragUpNeverDismisses() {
        #expect(!SheetDrag.shouldDismiss(translation: -200, velocity: 1500, height: 400))
        #expect(!SheetDrag.shouldDismiss(translation: 0, velocity: 1500, height: 400))
        #expect(!SheetDrag.shouldDismiss(translation: 200, velocity: 0, height: 0))
    }

    @Test func theSheetFollowsTheFingerDownAndStretchesLessAndLessUp() {
        #expect(SheetDrag.offset(for: 75) == 75)
        #expect(SheetDrag.offset(for: 0) == 0)
        let small = SheetDrag.offset(for: -20)
        let big = SheetDrag.offset(for: -400)
        #expect(small < 0 && small > -20)
        #expect(big < small && big > -SheetDrag.stretch - 0.001)
    }
}
