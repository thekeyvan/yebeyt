import SwiftUI

/// The views of the motion vocabulary (`Motion.swift`).
extension View {
    /// A like or a keep: turning on pops with a wiggle, flies a burst and taps medium; turning off only pops a little.
    /// A like or a keep: `taps` is the count of the control's own taps (`MarkButton` gives it). Only a change that comes
    /// with a tap bursts and taps; one from elsewhere (a sync, the same couplet in another view) at most pops small.
    /// `id` says which thing the mark is on: when it changes (a page scrolled to another couplet) nothing pops.
    func markMotion(on: Bool, id: AnyHashable = 0, taps: Int) -> some View {
        modifier(MarkMotion(on: on, id: id, taps: taps))
    }

    /// Pops (and, when asked, bursts and gives `feedback`) when `condition` turns true: a tab's icon, a right answer.
    func popWhen(_ condition: Bool, wiggle: Bool = false, burst: Burst.Style? = nil, feedback: SensoryFeedback? = nil) -> some View {
        modifier(Reaction(condition: condition, wiggle: wiggle, burst: burst, feedback: feedback, shakes: false))
    }

    /// Shakes (and gives `feedback`) when `condition` turns true: a wrong answer.
    func shakeWhen(_ condition: Bool, feedback: SensoryFeedback? = nil) -> some View {
        modifier(Reaction(condition: condition, wiggle: false, burst: nil, feedback: feedback, shakes: true))
    }

    /// Pops each time `value` changes: a score that went up.
    func popOn(_ value: some Equatable) -> some View {
        modifier(ValuePop(value: value))
    }

    /// The end of a round, when it appears: a win pops with a big burst and a success tap, anything else only pops.
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

    /// The verdict of an answer, when it appears: right pops with a burst and a success tap, wrong shakes with an error tap.
    func verdictMotion(right: Bool, burst: Burst.Style = .small) -> some View {
        modifier(AppearReaction(right: right, burst: burst))
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
}

private struct PopEffect: ViewModifier {
    let trigger: Int
    let pop: Motion.Pop

    func body(content: Content) -> some View {
        content.keyframeAnimator(initialValue: PopFrame(), trigger: trigger) { view, frame in
            view.scaleEffect(frame.scale).rotationEffect(.degrees(frame.rotation))
        } keyframes: { _ in
            KeyframeTrack(\.scale) {
                for step in pop.scales { CubicKeyframe(step.value, duration: step.duration) }
            }
            KeyframeTrack(\.rotation) {
                if pop.rotations.isEmpty {
                    LinearKeyframe(0, duration: pop.duration)
                } else {
                    for step in pop.rotations { CubicKeyframe(step.value, duration: step.duration) }
                }
            }
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
    let style: Burst.Style
    /// Mixed into the seed, so two controls' bursts don't look the same.
    @State private var salt = UInt64.random(in: .min ... .max)

    func body(content: Content) -> some View {
        let pieces = trigger == 0 ? [] : Burst.pieces(style, seed: salt &+ UInt64(trigger))
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
        switch piece.kind {
        case .dot:
            Circle().frame(width: piece.size, height: piece.size)
        case .dash:
            Capsule().frame(width: piece.size * 1.7, height: piece.size * 0.45).rotationEffect(.radians(piece.angle))
        case .square:
            RoundedRectangle(cornerRadius: 1.5).frame(width: piece.size * 0.8, height: piece.size * 0.8).rotationEffect(.degrees(frame.rotation))
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

private struct MarkMotion: ViewModifier {
    struct Snapshot: Equatable {
        var on: Bool
        var id: AnyHashable
        var taps: Int
    }

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
            .modifier(BurstEffect(trigger: bursts, style: .small))
            .onChange(of: Snapshot(on: on, id: id, taps: taps)) { old, new in
                if new.taps != old.taps { lastTapAt = .now }
                guard old.id == new.id, old.on != new.on else { return }
                let outcome = Motion.markOutcome(turnedOn: new.on, tapped: Motion.isOwnTap(lastTapAt: lastTapAt, now: .now), variant: variant)
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
    let burst: Burst.Style?
    let feedback: SensoryFeedback?
    let shakes: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var count = 0

    func body(content: Content) -> some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        content
            .modifier(PopEffect(trigger: shakes ? 0 : count, pop: .turningOn(variant, wiggle: wiggle)))
            .modifier(ShakeEffect(trigger: shakes ? count : 0))
            .modifier(BurstEffect(trigger: burst != nil && Motion.bursts(variant) ? count : 0, style: burst ?? .small))
            .onChange(of: condition) { _, now in if now { count += 1 } }
            .sensoryFeedback(trigger: count) { _, _ in feedback }
    }
}

private struct AppearReaction: ViewModifier {
    let right: Bool
    let burst: Burst.Style
    @State private var appeared = false

    func body(content: Content) -> some View {
        Group {
            if right {
                content.popWhen(appeared, wiggle: true, burst: burst, feedback: .success)
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
                content.popWhen(appeared, wiggle: true, burst: .big, feedback: .success)
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
