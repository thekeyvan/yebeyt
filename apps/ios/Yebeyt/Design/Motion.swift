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
        /// Points sideways (the screen's left is negative); 0 for most.
        var dx: Double = 0
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
        .offset(x: arrival.dx, y: arrival.dy).combined(with: .scale(scale: arrival.scale)).combined(with: .opacity)
    }

    // MARK: Sheets, covers, menus, rows and tabs

    /// A sheet or cover drops back down quickly (no overshoot); it rises with `bouncy`.
    static let drop = Animation.spring(response: 0.25, dampingFraction: 1)

    /// Under Reduce Motion nothing rises, slides or scales: it crossfades.
    static func rises(_ variant: Variant) -> Bool { variant == .full }

    /// A menu, a popover or a card that appears: a little smaller, growing from where it belongs.
    static func menuArrival(_ variant: Variant) -> Arrival { variant == .full ? Arrival(dy: 0, scale: 0.9) : Arrival(dy: 0, scale: 1) }

    /// A list row that is added or taken away: a little smaller and 12 points lower.
    static func rowArrival(_ variant: Variant) -> Arrival { variant == .full ? Arrival(dy: 12, scale: 0.9) : Arrival(dy: 0, scale: 1) }

    /// How far a tab page slides: the new one in from its tab's side, the old one out to the far side.
    static let tabSlide = 40.0

    /// The tab's page slides in from the side its tab is on: `rightToLeft` is the layout, where the first tab is at the
    /// right, so a tab after the open one is at the left. `dx` is in screen directions. Plain fade under Reduce Motion.
    static func tabArrival(from old: Int, to new: Int, rightToLeft: Bool, _ variant: Variant) -> Arrival {
        guard variant == .full, old != new else { return Arrival(dy: 0, scale: 1) }
        let towardEnd = new > old
        let toTheRight = towardEnd != rightToLeft
        return Arrival(dy: 0, scale: 1, dx: toTheRight ? tabSlide : -tabSlide)
    }

    /// The page of a segment (a `SegmentedControl`'s content) slides in from its segment's side. `.offset` is mirrored in
    /// right-to-left, so `dx` is the same in both layouts: positive toward a later segment, negative toward an earlier one.
    /// A fade only under Reduce Motion or when no segment changed.
    static func pageArrival(from old: Int, to new: Int, _ variant: Variant) -> Arrival {
        guard variant == .full, old != new else { return Arrival(dy: 0, scale: 1) }
        return Arrival(dy: 0, scale: 1, dx: new > old ? tabSlide : -tabSlide)
    }

    /// A sheet or overlay: rises from the bottom with `bouncy`, drops quickly; a crossfade under Reduce Motion.
    static func sheet(_ variant: Variant) -> AnyTransition {
        guard rises(variant) else { return .opacity }
        return .asymmetric(insertion: .move(edge: .bottom).animation(bouncy), removal: .move(edge: .bottom).animation(drop))
    }

    /// The dimmed background behind a sheet fades in and out (also under Reduce Motion).
    static var scrim: AnyTransition { .opacity }

    // MARK: Covers

    /// A full-screen cover (the reader, a game) is one layer: `CoverLayer` moves all of it with one offset, so nothing in
    /// it is drawn or moved on its own. Away it sits a screen's height down; Reduce Motion keeps it in place and fades.
    static func coverOffset(risen: Bool, height: Double, _ variant: Variant) -> Double {
        rises(variant) && !risen ? height : 0
    }

    static func coverOpacity(risen: Bool, _ variant: Variant) -> Double {
        rises(variant) || risen ? 1 : 0
    }

    /// It rises with `bouncy` and drops quickly; Reduce Motion crossfades both ways.
    static func coverRise(_ variant: Variant) -> Animation { rises(variant) ? bouncy : .easeOut(duration: 0.2) }

    static func coverDrop(_ variant: Variant) -> Animation { rises(variant) ? drop : .easeOut(duration: 0.2) }

    /// A menu or card from its origin: scales up from 0.9 with `bouncy`, goes away quickly.
    static func menu(_ variant: Variant, anchor: UnitPoint = .center) -> AnyTransition {
        guard rises(variant) else { return .opacity }
        let scaled = AnyTransition.scale(scale: menuArrival(variant).scale, anchor: anchor).combined(with: .opacity)
        return .asymmetric(insertion: scaled.animation(bouncy), removal: scaled.animation(drop))
    }

    /// A list row added or taken away: scale and slide with `bouncy`.
    static func row(_ variant: Variant) -> AnyTransition {
        guard rises(variant) else { return .opacity }
        return arrive(rowArrival(variant)).animation(bouncy)
    }

    /// The page of a tab slides in from the tapped tab's side while the old page slides out to the far side, both with
    /// `bouncy`; the opacity follows quickly as a secondary. `incoming` and `outgoing` are in the same units as `Arrival.dx`.
    static func tab(incoming: Arrival, outgoing: Arrival, _ variant: Variant) -> AnyTransition {
        guard rises(variant) else { return .opacity }
        return .asymmetric(insertion: slide(incoming), removal: slide(outgoing))
    }

    /// The old page goes out the way the new one does not come from.
    static func departure(of arrival: Arrival) -> Arrival { Arrival(dy: arrival.dy, scale: arrival.scale, dx: -arrival.dx) }

    private static func slide(_ arrival: Arrival) -> AnyTransition {
        AnyTransition.offset(x: arrival.dx).animation(bouncy).combined(with: AnyTransition.opacity.animation(drop))
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
