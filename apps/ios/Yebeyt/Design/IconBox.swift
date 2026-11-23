import SwiftUI

/// Maps the 24×24 box of the icon SVGs onto a rectangle.
struct Box {
    let scale: CGFloat
    let origin: CGPoint

    init(_ rect: CGRect) {
        scale = min(rect.width, rect.height) / 24
        origin = CGPoint(x: rect.midX - 12 * scale, y: rect.midY - 12 * scale)
    }

    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: origin.x + x * scale, y: origin.y + y * scale)
    }

    func rect(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat) -> CGRect {
        CGRect(origin: point(x, y), size: CGSize(width: width * scale, height: height * scale))
    }

    func circle(_ x: CGFloat, _ y: CGFloat, radius: CGFloat) -> CGRect {
        rect(x - radius, y - radius, radius * 2, radius * 2)
    }

    /// SVG's `A r r 0 0 sweep x y`: a circular arc of less than half a turn from `from` to `to`, in box units.
    /// `sweep` true turns clockwise on screen (the SVG's sweep flag 1).
    func arc(_ path: inout Path, from: (CGFloat, CGFloat), to: (CGFloat, CGFloat), radius: CGFloat, sweep: Bool) {
        let dx = to.0 - from.0, dy = to.1 - from.1
        let chord = (dx * dx + dy * dy).squareRoot()
        let height = max(radius * radius - chord * chord / 4, 0).squareRoot()
        let side: CGFloat = sweep ? 1 : -1
        let center = (x: (from.0 + to.0) / 2 - side * height * dy / chord, y: (from.1 + to.1) / 2 + side * height * dx / chord)
        let start = atan2(from.1 - center.y, from.0 - center.x)
        let end = atan2(to.1 - center.y, to.0 - center.x)
        // SwiftUI's `clockwise` is the opposite of what is seen on screen, because y grows downwards.
        path.addArc(center: point(center.x, center.y), radius: radius * scale, startAngle: .radians(start), endAngle: .radians(end), clockwise: !sweep)
    }
}
