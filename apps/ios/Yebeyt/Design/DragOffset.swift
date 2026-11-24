import SwiftUI

/// SwiftUI mirrors `.offset`'s x in right-to-left layouts, but a drag's `translation` is physical. This follows the
/// finger in both directions.
enum DragOffset {
    static func offset(for translation: CGSize, in direction: LayoutDirection) -> CGSize {
        CGSize(width: direction == .rightToLeft ? -translation.width : translation.width, height: translation.height)
    }
}

extension View {
    /// Moves the view by a drag's `translation`, so it stays under the finger.
    func offset(dragged translation: CGSize) -> some View {
        modifier(DragOffsetModifier(translation: translation))
    }
}

private struct DragOffsetModifier: ViewModifier {
    @Environment(\.layoutDirection) private var direction
    let translation: CGSize

    func body(content: Content) -> some View {
        let offset = DragOffset.offset(for: translation, in: direction)
        content.offset(x: offset.width, y: offset.height)
    }
}
