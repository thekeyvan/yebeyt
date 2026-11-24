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

    static let pressedScale = 0.92
    /// How long a burst lives: its pieces have faded by then.
    static let burstDuration = 0.6

    /// A toast drops in from above, a little smaller, and simply fades when it goes.
    static var toast: AnyTransition {
        .asymmetric(insertion: .offset(y: -28).combined(with: .scale(scale: 0.9)).combined(with: .opacity), removal: .opacity)
    }

    /// The next card of the deck springs in, a little smaller; the thrown one is already gone.
    static var deal: AnyTransition {
        .asymmetric(insertion: .scale(scale: 0.8).combined(with: .opacity), removal: .identity)
    }

    // MARK: Pop

    /// One stop of a keyframe track: go to `value` in `duration` seconds.
    struct Step: Equatable, Sendable {
        var value: Double
        var duration: Double
    }

    /// A pop: the scale and the rotation (in degrees) it goes through, as keyframe steps.
    struct Pop: Equatable, Sendable {
        var scales: [Step]
        var rotations: [Step]

        var duration: Double { max(scales.reduce(0) { $0 + $1.duration }, rotations.reduce(0) { $0 + $1.duration }) }

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

    /// A wrong answer: side to side (points), stronger than the first shake, over 0.45 s.
    static let shake = [
        Step(value: 14, duration: 0.05), Step(value: -14, duration: 0.09), Step(value: 10, duration: 0.09),
        Step(value: -6, duration: 0.09), Step(value: 3, duration: 0.08), Step(value: 0, duration: 0.05),
    ]
}

/// The burst of small sticker-coloured pieces that flies out of a control on a success: dots, short dashes and small
/// squares (no crescents, no stars). Pieces are made from a seed, so a burst can be tested.
enum Burst {
    enum Kind: CaseIterable, Sendable { case dot, dash, square }
    enum Tint: CaseIterable, Sendable { case magenta, amber, lapis, green, fire }

    struct Style: Equatable, Sendable {
        /// How far the pieces fly, in points.
        var radius: Double
        /// The size of a dot.
        var size: Double

        static let small = Style(radius: 34, size: 7)
        /// For a result: a finished game or a daily puzzle.
        static let big = Style(radius: 74, size: 11)
    }

    struct Piece: Equatable, Identifiable, Sendable {
        var id: Int
        /// Where it flies, in radians from the physical right, clockwise on screen.
        var angle: Double
        var distance: Double
        var size: Double
        var spin: Double
        var kind: Kind
        var tint: Tint
    }

    /// 6 to 8 pieces spread around the circle, one of them every sector, each with a little jitter.
    static func pieces(_ style: Style, seed: UInt64) -> [Piece] {
        var generator = SeededGenerator(seed: seed)
        let count = Int.random(in: 6...8, using: &generator)
        let step = 2 * Double.pi / Double(count)
        let start = Double.random(in: 0..<step, using: &generator)
        return (0..<count).map { index in
            let jitter = Double.random(in: -0.3...0.3, using: &generator) * step
            let angle = (start + Double(index) * step + jitter + 2 * .pi).truncatingRemainder(dividingBy: 2 * .pi)
            return Piece(
                id: index, angle: angle,
                distance: style.radius * Double.random(in: 0.7...1, using: &generator),
                size: style.size * Double.random(in: 0.8...1.2, using: &generator),
                spin: Double.random(in: -200...200, using: &generator),
                kind: Kind.allCases[(index + Int.random(in: 0..<3, using: &generator)) % Kind.allCases.count],
                tint: Tint.allCases[Int.random(in: 0..<Tint.allCases.count, using: &generator)]
            )
        }
    }

    /// Where a piece is `progress` (0...1) of the way through the burst: out fast, slowing down, fading in the second half.
    struct Frame: Equatable, Sendable {
        var dx: Double
        var dy: Double
        var opacity: Double
        var scale: Double
        var rotation: Double

        init(_ piece: Piece, progress: Double) {
            let eased = 1 - pow(1 - progress, 3)
            dx = cos(piece.angle) * piece.distance * eased
            dy = sin(piece.angle) * piece.distance * eased
            opacity = progress <= 0 || progress >= 1 ? 0 : progress < 0.45 ? 1 : 1 - (progress - 0.45) / 0.55
            scale = progress < 0.45 ? 0.5 + 0.5 * min(progress / 0.2, 1) : 1 - 0.5 * (progress - 0.45) / 0.55
            rotation = piece.spin * eased
        }
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
