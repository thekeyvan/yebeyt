import SwiftUI

/// The app's one motion vocabulary: how things appear, pop, squish, burst and are thrown away. The values live here,
/// the views that use them are in `MotionEffects.swift`. Reduce Motion picks the `reduced` variant: no burst, no wiggle,
/// a pop that is only a short scale to 1.05 (haptics stay).
enum Motion {
    enum Variant { case full, reduced }

    static func variant(reduceMotion: Bool) -> Variant { reduceMotion ? .reduced : .full }

    static func bursts(_ variant: Variant) -> Bool { variant == .full }

    // MARK: Springs

    /// Things that appear or move: a visible overshoot.
    static let bouncy = Animation.spring(response: 0.35, dampingFraction: 0.55)
    /// A pressed button letting go: springs back past 1.
    static let press = Animation.spring(response: 0.3, dampingFraction: 0.5)
    /// A card thrown off the deck.
    static let throwAway = Animation.spring(response: 0.32, dampingFraction: 0.72)

    /// How far a pressed button squishes (barely, and without a spring, under Reduce Motion).
    static func pressedScale(_ variant: Variant) -> Double { variant == .full ? 0.92 : 0.97 }

    static func pressAnimation(_ variant: Variant) -> Animation { variant == .full ? press : .easeOut(duration: 0.1) }

    /// How long a burst lives: its pieces have faded by then.
    static let burstDuration = 0.6

    /// The end-of-round numbers counting up; under Reduce Motion they jump (no animation).
    static func countUp(_ variant: Variant) -> Animation? { variant == .full ? .easeOut(duration: 0.5) : nil }

    // MARK: Arrivals

    /// Where a view comes from: `dy` points above and `scale` of its size, fading in. 0 and 1 is a plain fade.
    struct Arrival: Equatable, Sendable {
        var dy: Double
        var scale: Double
    }

    /// A toast drops in from above, a little smaller (only fades under Reduce Motion), and simply fades when it goes.
    static func toastArrival(_ variant: Variant) -> Arrival { variant == .full ? Arrival(dy: -28, scale: 0.9) : Arrival(dy: 0, scale: 1) }

    /// The next card of the deck springs in, a little smaller; the thrown one is already gone.
    static func dealArrival(_ variant: Variant) -> Arrival { variant == .full ? Arrival(dy: 0, scale: 0.8) : Arrival(dy: 0, scale: 1) }

    static func toast(_ variant: Variant) -> AnyTransition {
        .asymmetric(insertion: arrive(toastArrival(variant)), removal: .opacity)
    }

    static func deal(_ variant: Variant) -> AnyTransition {
        .asymmetric(insertion: arrive(dealArrival(variant)), removal: .identity)
    }

    private static func arrive(_ arrival: Arrival) -> AnyTransition {
        .offset(y: arrival.dy).combined(with: .scale(scale: arrival.scale)).combined(with: .opacity)
    }

    // MARK: Thrown card

    /// How a card on the deck sits: the tilt (degrees), where it is (points) and its opacity.
    struct ThrowPose: Equatable, Sendable {
        var rotation: Double
        var dx: Double
        var dy: Double
        var opacity: Double

        static let resting = ThrowPose(rotation: 0, dx: 0, dy: 0, opacity: 1)

        /// Flung off to the side, tilted; with Reduce Motion it stays and fades.
        static func thrown(_ variant: Variant) -> ThrowPose {
            variant == .full ? ThrowPose(rotation: -18, dx: -480, dy: -30, opacity: 1) : ThrowPose(rotation: 0, dx: 0, dy: 0, opacity: 0)
        }
    }

    // MARK: Pop

    /// One stop of a keyframe track: go to `value` in `duration` seconds.
    struct Step: Equatable, Sendable {
        var value: Double
        var duration: Double
    }

    /// A pop: the scale, the rotation (degrees), the shift (points) and the opacity it goes through, as keyframe steps.
    /// An empty track stays at rest.
    struct Pop: Equatable, Sendable {
        var scales: [Step]
        var rotations: [Step]
        var dxs: [Step] = []
        var dys: [Step] = []
        var opacities: [Step] = []

        var duration: Double {
            [scales, rotations, dxs, dys, opacities].map { $0.reduce(0) { $0 + $1.duration } }.max() ?? 0
        }

        /// What the icon of `action` does when it is turned on or tapped; with Reduce Motion a short scale for all.
        static func turningOn(_ action: Burst.Action, _ variant: Variant) -> Pop {
            guard variant == .full else { return reducedPop }
            switch action.icon {
            case .pop:
                return turningOn(.full)
            case .drop:  // from 18 points above, with a bounce
                return Pop(
                    scales: [Step(value: 1.1, duration: 0.15), Step(value: 1, duration: 0.25)], rotations: [],
                    dys: [Step(value: -18, duration: 0.01), Step(value: 5, duration: 0.13), Step(value: -3, duration: 0.1), Step(value: 1.5, duration: 0.09), Step(value: 0, duration: 0.09)]
                )
            case .spin:  // once around
                return Pop(scales: [Step(value: 1.2, duration: 0.2), Step(value: 1, duration: 0.25)], rotations: [Step(value: 360, duration: 0.45)])
            case .fly:  // off toward the top corner, back in from the opposite one
                return Pop(
                    scales: [Step(value: 0.9, duration: 0.16), Step(value: 0.9, duration: 0.01), Step(value: 1, duration: 0.2)], rotations: [],
                    dxs: [Step(value: 26, duration: 0.16), Step(value: -18, duration: 0.01), Step(value: 0, duration: 0.2)],
                    dys: [Step(value: -26, duration: 0.16), Step(value: 18, duration: 0.01), Step(value: 0, duration: 0.2)],
                    opacities: [Step(value: 0, duration: 0.16), Step(value: 0, duration: 0.01), Step(value: 1, duration: 0.2)]
                )
            }
        }

        /// 1 → 1.35 → 0.9 → 1.05 → 1 over 0.45 s, with a wiggle of ±8° for stickers.
        static func turningOn(_ variant: Variant, wiggle: Bool = true) -> Pop {
            switch variant {
            case .full:
                Pop(
                    scales: [Step(value: 1.35, duration: 0.12), Step(value: 0.9, duration: 0.12), Step(value: 1.05, duration: 0.11), Step(value: 1, duration: 0.10)],
                    rotations: wiggle ? [Step(value: 8, duration: 0.11), Step(value: -8, duration: 0.12), Step(value: 4, duration: 0.11), Step(value: 0, duration: 0.11)] : []
                )
            case .reduced:
                reducedPop
            }
        }

        /// Taking a mark off: the same, smaller and shorter, and still.
        static func turningOff(_ variant: Variant) -> Pop {
            switch variant {
            case .full: Pop(scales: [Step(value: 1.15, duration: 0.12), Step(value: 0.95, duration: 0.1), Step(value: 1, duration: 0.08)], rotations: [])
            case .reduced: reducedPop
            }
        }

        private static let reducedPop = Pop(scales: [Step(value: 1.05, duration: 0.1), Step(value: 1, duration: 0.1)], rotations: [])
    }

    // MARK: Shake

    /// A wrong answer: side to side (points), stronger than the first shake, over 0.45 s. Still under Reduce Motion.
    static func shake(_ variant: Variant) -> [Step] {
        switch variant {
        case .full:
            [Step(value: 14, duration: 0.05), Step(value: -14, duration: 0.09), Step(value: 10, duration: 0.09),
             Step(value: -6, duration: 0.09), Step(value: 3, duration: 0.08), Step(value: 0, duration: 0.05)]
        case .reduced:
            [Step(value: 0, duration: 0.05)]
        }
    }

    // MARK: A like, a keep, a repost, a send

    /// What a mark's state change does. Only a change right after a tap on its own control gets the particles and the
    /// tap; one that comes from elsewhere (a sync, the same couplet in another view) at most pops small.
    struct MarkOutcome: Equatable, Sendable {
        var pop: Pop
        /// Particles fly (the action has some, and Reduce Motion is off).
        var burst: Bool
        var haptic: Bool
    }

    /// How long after a tap on the control its state change still counts as the tap's (a like waits for the server).
    static let tapWindow = 1.0

    static func isOwnTap(lastTapAt: Date?, now: Date) -> Bool {
        lastTapAt.map { now.timeIntervalSince($0) <= tapWindow } ?? false
    }

    /// `tapped`: see `isOwnTap`. A send is never on or off: its tap is its change, and it has no particles and no tap.
    static func markOutcome(_ action: Burst.Action, turnedOn: Bool, tapped: Bool, variant: Variant) -> MarkOutcome {
        guard tapped, turnedOn else { return MarkOutcome(pop: .turningOff(variant), burst: false, haptic: false) }
        return MarkOutcome(pop: .turningOn(action, variant), burst: bursts(variant) && !action.kinds.isEmpty, haptic: action != .send)
    }
}

/// A number that counts up to its value when the value is animated (`withAnimation { value = n }`).
struct CountUp: View, Animatable {
    nonisolated var value: Double

    nonisolated var animatableData: Double {
        get { value }
        set { value = newValue }
    }

    var prefix = ""
    var suffix = ""

    static func text(_ value: Double) -> String { PersianDigits.string(Int(value.rounded())) }

    var body: some View { Text(prefix + Self.text(value) + suffix) }
}
