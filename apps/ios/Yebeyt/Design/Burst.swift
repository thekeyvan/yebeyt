import Foundation

/// The pieces that come out of a control on a success, each action with its own: hearts rise from a like, bookmark
/// ribbons fan out of a keep, arrows circle out of a repost, ticks pop out of a right answer, and a won round gets
/// confetti (dots, short dashes, small squares). A send has none: its icon flies off and lands back. No crescents or
/// stars. Pieces are made from a seed, so a burst can be tested.
enum Burst {
    enum Kind: CaseIterable, Sendable { case dot, dash, square, heart, ribbon, arrow, tick }
    enum Tint: CaseIterable, Sendable { case magenta, amber, lapis, green, fire }

    /// How the pieces travel.
    enum Flight: Sendable {
        /// Out from the icon in every direction.
        case radial
        /// Out in an upward fan.
        case fan
        /// Up, drifting from side to side.
        case rise
        /// Out along a curve, circling.
        case orbit
    }

    /// What the icon itself does.
    enum IconMotion: Sendable {
        /// Scale up and down with a wiggle.
        case pop
        /// Drops in from above with a bounce.
        case drop
        /// Turns once around.
        case spin
        /// Flies off toward its corner and lands back.
        case fly
    }

    enum Action: CaseIterable, Sendable {
        case like, keep, repost, send, right, win

        var kinds: [Kind] {
            switch self {
            case .like: [.heart]
            case .keep: [.ribbon]
            case .repost: [.arrow]
            case .send: []
            case .right: [.tick]
            case .win: [.dot, .dash, .square]
            }
        }

        var count: ClosedRange<Int> {
            switch self {
            case .like: 4...6
            case .keep: 3...4
            case .repost: 2...2
            case .send: 0...0
            case .right: 4...6
            case .win: 6...8
            }
        }

        var tints: [Tint] {
            switch self {
            case .like: [.fire, .magenta]
            case .keep, .repost: [.lapis]
            case .send: []
            case .right: [.green]
            case .win: Tint.allCases
            }
        }

        var flight: Flight {
            switch self {
            case .like: .rise
            case .keep: .fan
            case .repost: .orbit
            case .send, .right, .win: .radial
            }
        }

        var icon: IconMotion {
            switch self {
            case .keep: .drop
            case .repost: .spin
            case .send: .fly
            case .like, .right, .win: .pop
            }
        }

        /// How far and how big, unless asked for another.
        var style: Style {
            switch self {
            case .like: Style(radius: 46, size: 13)
            case .keep: Style(radius: 38, size: 13)
            case .repost: Style(radius: 34, size: 12)
            case .send: Style(radius: 0, size: 0)
            case .right: Style(radius: 36, size: 13)
            case .win: .small
            }
        }
    }

    struct Style: Equatable, Sendable {
        /// How far the pieces fly, in points.
        var radius: Double
        /// The size of a piece.
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
        /// Degrees: how far a square turns, how wide a heart drifts, how far an arrow circles.
        var spin: Double
        var kind: Kind
        var tint: Tint
        var flight: Flight
    }

    /// The pieces of `action`'s burst: spread around the circle (or the fan), each with a little jitter.
    static func pieces(_ action: Action, style: Style? = nil, seed: UInt64) -> [Piece] {
        let style = style ?? action.style
        var generator = SeededGenerator(seed: seed)
        let count = Int.random(in: action.count, using: &generator)
        guard count > 0 else { return [] }
        let step = 2 * Double.pi / Double(count)
        let start = Double.random(in: 0..<step, using: &generator)
        let kinds = action.kinds, tints = action.tints
        return (0..<count).map { index in
            let jitter = Double.random(in: -0.3...0.3, using: &generator)
            let angle: Double
            switch action.flight {
            case .radial, .orbit: angle = start + (Double(index) + jitter) * step
            case .fan: angle = fan(index, of: count, span: 2 * .pi / 3, jitter: jitter)
            case .rise: angle = fan(index, of: count, span: 1.2, jitter: jitter)
            }
            let spin: Double = switch action.flight {
            case .orbit: Double.random(in: 120...200, using: &generator) * (index.isMultiple(of: 2) ? 1 : -1)
            case .rise: Double.random(in: 120...200, using: &generator) * (Bool.random(using: &generator) ? 1 : -1)
            default: Double.random(in: -200...200, using: &generator)
            }
            return Piece(
                id: index, angle: (angle + 4 * .pi).truncatingRemainder(dividingBy: 2 * .pi),
                distance: style.radius * Double.random(in: 0.7...1, using: &generator),
                size: style.size * Double.random(in: 0.8...1.2, using: &generator),
                spin: spin,
                kind: kinds[(index + Int.random(in: 0..<kinds.count, using: &generator)) % kinds.count],
                tint: tints[Int.random(in: 0..<tints.count, using: &generator)],
                flight: action.flight
            )
        }
    }

    /// The `index`th of `count` angles spread over `span` radians around straight up.
    private static func fan(_ index: Int, of count: Int, span: Double, jitter: Double) -> Double {
        let slot = span / Double(count)
        return -Double.pi / 2 - span / 2 + (Double(index) + 0.5 + jitter * 0.6) * slot
    }

    /// Where a piece is `progress` (0...1) of the way through the burst: out fast, slowing down, fading in the second half.
    struct Frame: Equatable, Sendable {
        var dx: Double
        var dy: Double
        var opacity: Double
        var scale: Double
        /// Degrees: the turn of a square.
        var rotation: Double
        /// Degrees: the way a piece that points somewhere (a dash, a ribbon, an arrow) points.
        var heading: Double

        init(_ piece: Piece, progress: Double) {
            let eased = 1 - pow(1 - progress, 3)
            var angle = piece.angle
            switch piece.flight {
            case .radial, .fan:
                dx = cos(angle) * piece.distance * eased
                dy = sin(angle) * piece.distance * eased
                rotation = piece.spin * eased
                heading = angle * 180 / .pi
            case .rise:
                dx = cos(angle) * piece.distance * 0.35 * eased + piece.spin * 0.04 * sin(progress * 2 * .pi)
                dy = sin(angle) * piece.distance * eased
                rotation = 0
                heading = 0
            case .orbit:
                angle += piece.spin * .pi / 180 * eased
                dx = cos(angle) * piece.distance * eased
                dy = sin(angle) * piece.distance * eased
                rotation = 0
                heading = angle * 180 / .pi + (piece.spin > 0 ? 90 : -90)
            }
            opacity = progress <= 0 || progress >= 1 ? 0 : progress < 0.45 ? 1 : 1 - (progress - 0.45) / 0.55
            scale = progress < 0.45 ? 0.5 + 0.5 * min(progress / 0.2, 1) : 1 - 0.5 * (progress - 0.45) / 0.55
        }
    }
}
