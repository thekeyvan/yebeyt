import SwiftUI

/// A shape from the `d` string of an SVG path, drawn in the 24×24 box of the icon SVGs and never mirrored.
/// The game icons keep their SVG paths from design/canvas/gameicons.py word for word. Circular arcs only.
struct SVGShape: Shape {
    let d: String

    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let box = Box(rect)
        return SVGPathParser.path(d).applying(CGAffineTransform(scaleX: box.scale, y: box.scale).concatenating(CGAffineTransform(translationX: box.origin.x, y: box.origin.y)))
    }
}

enum SVGPathParser {
    /// The path in the SVG's own units. Handles M L H V C S Q A Z and their relative forms.
    static func path(_ d: String) -> Path {
        var reader = Reader(Array(d))
        var path = Path()
        var current = CGPoint.zero, start = CGPoint.zero, lastControl: CGPoint?
        var command: Character = "M"
        while true {
            if let letter = reader.command() { command = letter } else if !reader.hasNumber { break }
            let next = command
            let relative = next.isLowercase
            let origin = relative ? current : .zero
            func point() -> CGPoint { CGPoint(x: origin.x + reader.number(), y: origin.y + reader.number()) }
            var control: CGPoint?
            switch next.uppercased() {
            case "M":
                current = point(); start = current
                path.move(to: current)
                command = relative ? "l" : "L"
            case "L":
                current = point(); path.addLine(to: current)
            case "H":
                current.x = origin.x + reader.number(); path.addLine(to: current)
            case "V":
                current.y = origin.y + reader.number(); path.addLine(to: current)
            case "C":
                let (c1, c2, end) = (point(), point(), point())
                path.addCurve(to: end, control1: c1, control2: c2)
                control = c2; current = end
            case "S":
                let reflected = lastControl.map { CGPoint(x: 2 * current.x - $0.x, y: 2 * current.y - $0.y) } ?? current
                let (c2, end) = (point(), point())
                path.addCurve(to: end, control1: reflected, control2: c2)
                control = c2; current = end
            case "Q":
                let (c, end) = (point(), point())
                path.addQuadCurve(to: end, control: c)
                current = end
            case "A":
                let radius = CGFloat(reader.number())
                _ = reader.number()  // y radius: the icons only use circles
                _ = reader.number()  // rotation
                let large = reader.number() != 0, sweep = reader.number() != 0
                let end = point()
                addArc(&path, from: current, to: end, radius: radius, large: large, sweep: sweep)
                current = end
            case "Z":
                path.closeSubpath(); current = start
            default:
                return path
            }
            lastControl = control
        }
        return path
    }

    /// SVG's arc `A r r 0 large sweep x y` for a circle, from the endpoints (SVG spec, F.6.5).
    private static func addArc(_ path: inout Path, from p0: CGPoint, to p1: CGPoint, radius: CGFloat, large: Bool, sweep: Bool) {
        guard p0 != p1, radius > 0 else { return }
        let half = CGPoint(x: (p0.x - p1.x) / 2, y: (p0.y - p1.y) / 2)
        let halfChord = (half.x * half.x + half.y * half.y).squareRoot()
        let r = max(radius, halfChord)
        let height = max(r * r - halfChord * halfChord, 0).squareRoot() / halfChord
        let sign: CGFloat = large == sweep ? -1 : 1
        let center = CGPoint(
            x: sign * height * half.y + (p0.x + p1.x) / 2,
            y: -sign * height * half.x + (p0.y + p1.y) / 2
        )
        // SwiftUI's `clockwise` is the opposite of what is seen on screen, because y grows downwards.
        path.addArc(
            center: center, radius: r, startAngle: .radians(atan2(p0.y - center.y, p0.x - center.x)),
            endAngle: .radians(atan2(p1.y - center.y, p1.x - center.x)), clockwise: !sweep
        )
    }

    private struct Reader {
        let text: [Character]
        var position = 0

        init(_ text: [Character]) { self.text = text }

        private mutating func skipSeparators() {
            while position < text.count, text[position] == " " || text[position] == "," || text[position] == "\n" { position += 1 }
        }

        /// The next command letter, if the text is at one.
        mutating func command() -> Character? {
            skipSeparators()
            guard position < text.count, text[position].isLetter else { return nil }
            position += 1
            return text[position - 1]
        }

        var hasNumber: Bool {
            var copy = self
            copy.skipSeparators()
            return copy.position < copy.text.count && !copy.text[copy.position].isLetter
        }

        mutating func number() -> Double {
            skipSeparators()
            var literal = ""
            var seenDot = false
            while position < text.count {
                let character = text[position]
                if character == "-" || character == "+" { if !literal.isEmpty { break } } else if character == "." {
                    if seenDot { break }
                    seenDot = true
                } else if !character.isNumber { break }
                literal.append(character)
                position += 1
            }
            return Double(literal) ?? 0
        }
    }
}
