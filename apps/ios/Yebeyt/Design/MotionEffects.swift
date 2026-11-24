import SwiftUI

/// The views of the motion vocabulary (`Motion.swift`).
extension View {
    /// A like or a keep: turning on pops with a wiggle, flies a burst and taps medium; turning off only pops a little.
    /// `id` says which thing the mark is on: when it changes (a page scrolled to another couplet) nothing pops.
    func markMotion(on: Bool, id: AnyHashable = 0) -> some View {
        modifier(MarkMotion(on: on, id: id))
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

    /// The verdict of an answer, when it appears: right pops with a burst and a success tap, wrong shakes with an error tap.
    func verdictMotion(right: Bool, burst: Burst.Style = .small) -> some View {
        modifier(AppearReaction(right: right, burst: burst))
    }

    /// A short shake to the sides whenever `trigger` changes.
    func shake(_ trigger: Int) -> some View {
        modifier(ShakeEffect(trigger: trigger))
    }

    /// A card thrown off the deck: it flies out to the left, tilted (with Reduce Motion it only fades).
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

private struct PressSquish: ViewModifier {
    let pressed: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .scaleEffect(pressed ? (reduceMotion ? 0.97 : Motion.pressedScale) : 1)
            .animation(reduceMotion ? .easeOut(duration: 0.1) : Motion.press, value: pressed)
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
        content.keyframeAnimator(initialValue: 0.0, trigger: trigger) { view, offset in
            view.offset(x: reduceMotion ? 0 : offset)
        } keyframes: { _ in
            KeyframeTrack {
                for step in Motion.shake { LinearKeyframe(step.value, duration: step.duration) }
            }
        }
    }
}

private struct ThrownEffect: ViewModifier {
    let thrown: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .tilted(thrown && !reduceMotion ? -18 : 0)
            .offset(x: thrown && !reduceMotion ? -480 : 0, y: thrown && !reduceMotion ? -30 : 0)
            .opacity(thrown && reduceMotion ? 0 : 1)
    }
}

// MARK: Burst

private struct BurstEffect: ViewModifier {
    let trigger: Int
    let style: Burst.Style

    func body(content: Content) -> some View {
        content.overlay {
            Color.clear.keyframeAnimator(initialValue: 0.0, trigger: trigger) { _, progress in
                BurstLayer(pieces: Burst.pieces(style, seed: UInt64(trigger)), progress: progress)
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
    }

    let on: Bool
    let id: AnyHashable
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pops = 0
    @State private var bursts = 0
    @State private var turnedOn = false

    func body(content: Content) -> some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        content
            .modifier(PopEffect(trigger: pops, pop: turnedOn ? .turningOn(variant) : .turningOff(variant)))
            .modifier(BurstEffect(trigger: bursts, style: .small))
            .onChange(of: Snapshot(on: on, id: id)) { old, new in
                guard old.id == new.id, old.on != new.on else { return }
                turnedOn = new.on
                pops += 1
                if new.on, Motion.bursts(variant) { bursts += 1 }
            }
            .sensoryFeedback(.impact(weight: .medium), trigger: pops) { _, _ in turnedOn }
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
