import SwiftUI

/// SwiftUI mirrors rotation in right-to-left layouts; the board's CSS does not. This keeps the visual direction
/// the same in both: positive degrees turn clockwise on screen.
extension View {
    func tilted(_ degrees: Double) -> some View {
        modifier(FixedTilt(degrees: degrees))
    }
}

private struct FixedTilt: ViewModifier {
    @Environment(\.layoutDirection) private var direction
    let degrees: Double

    func body(content: Content) -> some View {
        content.rotationEffect(.degrees(direction == .rightToLeft ? -degrees : degrees))
    }
}
