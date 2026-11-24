import SwiftUI

/// The views of the motion vocabulary (`Motion.swift`).
extension View {
    /// The icon of a like, a keep, a repost or a send (`action`; nil for another icon). Turning on does what the action
    /// does (hearts rise, a bookmark drops in with ribbons, arrows spin and circle out; a send flies off and lands
    /// back) and taps medium; turning off only pops a little. `taps` is the count of the control's own taps
    /// (`MarkButton` gives it): only a change that comes with a tap gets the particles and the tap; one from elsewhere
    /// (a sync, the same couplet in another view) at most pops small. `id` says which thing the mark is on: when it
    /// changes (a page scrolled to another couplet) nothing pops.
    func markMotion(_ action: Burst.Action?, on: Bool = false, id: AnyHashable = 0, taps: Int) -> some View {
        modifier(OptionalMark(action: action, on: on, id: id, taps: taps))
    }

    /// Pops (and, when asked, bursts and gives `feedback`) when `condition` turns true: a tab's icon, a right answer.
    func popWhen(_ condition: Bool, wiggle: Bool = false, burst: Burst.Action? = nil, style: Burst.Style? = nil, feedback: SensoryFeedback? = nil) -> some View {
        modifier(Reaction(condition: condition, wiggle: wiggle, burst: burst, style: style, feedback: feedback, shakes: false))
    }

    /// Shakes (and gives `feedback`) when `condition` turns true: a wrong answer.
    func shakeWhen(_ condition: Bool, feedback: SensoryFeedback? = nil) -> some View {
        modifier(Reaction(condition: condition, wiggle: false, burst: nil, style: nil, feedback: feedback, shakes: true))
    }

    /// Pops each time `value` changes: a score that went up.
    func popOn(_ value: some Equatable) -> some View {
        modifier(ValuePop(value: value))
    }

    /// The end of a round, when it appears: a win pops with a big confetti burst and a success tap, anything else only pops.
    func celebrateOnAppear(_ celebrates: Bool) -> some View {
        modifier(AppearCelebration(celebrates: celebrates))
    }

    /// Toasts drop in (only fade under Reduce Motion).
    func toastTransition() -> some View {
        modifier(ArrivalTransition(toast: true))
    }

    /// The next card of the deck springs in (only fades under Reduce Motion).
    func dealTransition() -> some View {
        modifier(ArrivalTransition(toast: false))
    }

    /// The verdict of an answer, when it appears: right pops with ticks (or `burst`) and a success tap, wrong shakes with
    /// an error tap and no particles.
    func verdictMotion(right: Bool, burst: Burst.Action = .right, style: Burst.Style? = nil) -> some View {
        modifier(AppearReaction(right: right, burst: burst, style: style))
    }

    /// A short shake to the sides whenever `trigger` changes.
    func shake(_ trigger: Int) -> some View {
        modifier(ShakeEffect(trigger: trigger))
    }

    /// A card thrown off the deck: it flies out to the side, tilted (with Reduce Motion it only fades).
    func thrown(_ thrown: Bool) -> some View {
        modifier(ThrownEffect(thrown: thrown))
    }

    /// Squishes to 0.92 while `pressed` and springs back with an overshoot.
    func pressSquish(_ pressed: Bool) -> some View {
        modifier(PressSquish(pressed: pressed))
    }
}

/// The button style of tappable stickers and icons: `PressSquish` on the label.
struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.pressSquish(configuration.isPressed)
    }
}

extension ButtonStyle where Self == PressStyle {
    static var press: PressStyle { PressStyle() }
}

/// A button that counts its own taps, for `markMotion`: the label gets the count.
struct MarkButton<Label: View>: View {
    let action: () -> Void
    @ViewBuilder let label: (Int) -> Label
    @State private var taps = 0

    var body: some View {
        Button {
            taps += 1
            action()
        } label: {
            label(taps)
        }
    }
}

private struct PressSquish: ViewModifier {
    let pressed: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        content
            .scaleEffect(pressed ? Motion.pressedScale(variant) : 1)
            .animation(Motion.pressAnimation(variant), value: pressed)
    }
}

private struct ArrivalTransition: ViewModifier {
    let toast: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        content.transition(toast ? Motion.toast(variant) : Motion.deal(variant))
    }
}

// MARK: Pop, shake, throw

private struct PopFrame {
    var scale = 1.0
    var rotation = 0.0
    var dx = 0.0
    var dy = 0.0
    var opacity = 1.0
}

private struct PopEffect: ViewModifier {
    let trigger: Int
    let pop: Motion.Pop

    func body(content: Content) -> some View {
        content.keyframeAnimator(initialValue: PopFrame(), trigger: trigger) { view, frame in
            view.scaleEffect(frame.scale).rotationEffect(.degrees(frame.rotation)).offset(x: frame.dx, y: frame.dy).opacity(frame.opacity)
        } keyframes: { _ in
            KeyframeTrack(\.scale) { steps(pop.scales, rest: 1) }
            KeyframeTrack(\.rotation) { steps(pop.rotations, rest: 0) }
            KeyframeTrack(\.dx) { steps(pop.dxs, rest: 0) }
            KeyframeTrack(\.dy) { steps(pop.dys, rest: 0) }
            KeyframeTrack(\.opacity) { steps(pop.opacities, rest: 1) }
        }
    }

    @KeyframeTrackContentBuilder<Double> private func steps(_ steps: [Motion.Step], rest: Double) -> some KeyframeTrackContent<Double> {
        if steps.isEmpty {
            LinearKeyframe(rest, duration: pop.duration)
        } else {
            for step in steps { CubicKeyframe(step.value, duration: step.duration) }
        }
    }
}

private struct ShakeEffect: ViewModifier {
    let trigger: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let steps = Motion.shake(Motion.variant(reduceMotion: reduceMotion))
        content.keyframeAnimator(initialValue: 0.0, trigger: trigger) { view, offset in
            view.offset(x: offset)
        } keyframes: { _ in
            KeyframeTrack {
                for step in steps { LinearKeyframe(step.value, duration: step.duration) }
            }
        }
    }
}

private struct ThrownEffect: ViewModifier {
    let thrown: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let pose = thrown ? Motion.ThrowPose.thrown(Motion.variant(reduceMotion: reduceMotion)) : .resting
        content
            .tilted(pose.rotation)
            .offset(x: pose.dx, y: pose.dy)
            .opacity(pose.opacity)
    }
}

// MARK: Burst

private struct BurstEffect: ViewModifier {
    let trigger: Int
    let action: Burst.Action
    let style: Burst.Style?
    /// Mixed into the seed, so two controls' bursts don't look the same.
    @State private var salt = UInt64.random(in: .min ... .max)

    func body(content: Content) -> some View {
        let pieces = trigger == 0 ? [] : Burst.pieces(action, style: style, seed: salt &+ UInt64(trigger))
        content.overlay {
            Color.clear.keyframeAnimator(initialValue: 0.0, trigger: trigger) { _, progress in
                // Mounted only while it flies.
                if progress > 0, progress < 1 { BurstLayer(pieces: pieces, progress: progress) }
            } keyframes: { _ in
                KeyframeTrack { LinearKeyframe(1.0, duration: Motion.burstDuration) }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

private struct BurstLayer: View {
    let pieces: [Burst.Piece]
    let progress: Double

    var body: some View {
        ZStack {
            ForEach(pieces) { piece in
                let frame = Burst.Frame(piece, progress: progress)
                shape(piece, frame)
                    .foregroundStyle(piece.tint.color)
                    .scaleEffect(frame.scale)
                    .offset(x: frame.dx, y: frame.dy)
                    .opacity(frame.opacity)
            }
        }
    }

    @ViewBuilder private func shape(_ piece: Burst.Piece, _ frame: Burst.Frame) -> some View {
        let size = piece.size
        switch piece.kind {
        case .dot:
            Circle().frame(width: size, height: size)
        case .dash:
            Capsule().frame(width: size * 1.7, height: size * 0.45).rotationEffect(.degrees(frame.heading))
        case .square:
            RoundedRectangle(cornerRadius: 1.5).frame(width: size * 0.8, height: size * 0.8).rotationEffect(.degrees(frame.rotation))
        case .heart:
            HeartIcon().fill().frame(width: size, height: size)
        case .ribbon:
            BookmarkIcon().fill().frame(width: size, height: size).rotationEffect(.degrees(frame.heading - 90))
        case .arrow:
            SVGShape(d: "M4 12h16M14 6l6 6-6 6").stroke(style: StrokeStyle(lineWidth: size * 0.22, lineCap: .round, lineJoin: .round))
                .frame(width: size, height: size).rotationEffect(.degrees(frame.heading))
        case .tick:
            CheckIcon().stroke(style: StrokeStyle(lineWidth: size * 0.26, lineCap: .round, lineJoin: .round)).frame(width: size, height: size)
        }
    }
}

private extension Burst.Tint {
    var color: Color {
        switch self {
        case .magenta: Tokens.Colors.magenta
        case .amber: Tokens.Colors.amber
        case .lapis: Tokens.Colors.lapis
        case .green: Tokens.Colors.green
        case .fire: Tokens.Colors.fire
        }
    }
}

// MARK: The modifiers

private struct OptionalMark: ViewModifier {
    let action: Burst.Action?
    let on: Bool
    let id: AnyHashable
    let taps: Int

    func body(content: Content) -> some View {
        if let action {
            content.modifier(MarkMotion(action: action, on: on, id: id, taps: taps))
        } else {
            content
        }
    }
}

private struct MarkMotion: ViewModifier {
    struct Snapshot: Equatable {
        var on: Bool
        var id: AnyHashable
        var taps: Int
    }

    let action: Burst.Action
    let on: Bool
    let id: AnyHashable
    let taps: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pops = 0
    @State private var bursts = 0
    @State private var haptics = 0
    @State private var pop = Motion.Pop.turningOff(.full)
    @State private var lastTapAt: Date?

    func body(content: Content) -> some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        content
            .modifier(PopEffect(trigger: pops, pop: pop))
            .modifier(BurstEffect(trigger: bursts, action: action, style: nil))
            .onChange(of: Snapshot(on: on, id: id, taps: taps)) { old, new in
                if new.taps != old.taps { lastTapAt = .now }
                // A send has no state: its tap is the change.
                let changed = action == .send ? new.taps != old.taps : old.id == new.id && old.on != new.on
                guard changed else { return }
                let outcome = Motion.markOutcome(
                    action, turnedOn: action == .send || new.on, tapped: Motion.isOwnTap(lastTapAt: lastTapAt, now: .now), variant: variant
                )
                pop = outcome.pop
                pops += 1
                if outcome.burst { bursts += 1 }
                if outcome.haptic { haptics += 1 }
            }
            .sensoryFeedback(.impact(weight: .medium), trigger: haptics)
    }
}

private struct Reaction: ViewModifier {
    let condition: Bool
    let wiggle: Bool
    let burst: Burst.Action?
    let style: Burst.Style?
    let feedback: SensoryFeedback?
    let shakes: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var count = 0

    func body(content: Content) -> some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        content
            .modifier(PopEffect(trigger: shakes ? 0 : count, pop: .turningOn(variant, wiggle: wiggle)))
            .modifier(ShakeEffect(trigger: shakes ? count : 0))
            .modifier(BurstEffect(trigger: burst != nil && Motion.bursts(variant) ? count : 0, action: burst ?? .win, style: style))
            .onChange(of: condition) { _, now in if now { count += 1 } }
            .sensoryFeedback(trigger: count) { _, _ in feedback }
    }
}

private struct AppearReaction: ViewModifier {
    let right: Bool
    let burst: Burst.Action
    let style: Burst.Style?
    @State private var appeared = false

    func body(content: Content) -> some View {
        Group {
            if right {
                content.popWhen(appeared, wiggle: true, burst: burst, style: style, feedback: .success)
            } else {
                content.shakeWhen(appeared, feedback: .error)
            }
        }
        .task { appeared = true }
    }
}

private struct AppearCelebration: ViewModifier {
    let celebrates: Bool

    /// A new identity when the result changes (a challenge's result comes in after the screen), so it celebrates then.
    func body(content: Content) -> some View {
        content.modifier(Celebrating(celebrates: celebrates)).id(celebrates)
    }
}

private struct Celebrating: ViewModifier {
    let celebrates: Bool
    @State private var appeared = false

    func body(content: Content) -> some View {
        Group {
            if celebrates {
                content.popWhen(appeared, wiggle: true, burst: .win, style: .big, feedback: .success)
            } else {
                content.popWhen(appeared)
            }
        }
        .task { appeared = true }
    }
}

private struct ValuePop<Value: Equatable>: ViewModifier {
    let value: Value
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pops = 0

    func body(content: Content) -> some View {
        content
            .modifier(PopEffect(trigger: pops, pop: .turningOn(Motion.variant(reduceMotion: reduceMotion), wiggle: false)))
            .onChange(of: value) { pops += 1 }
    }
}
