import SwiftUI

/// What every native sheet looks like: a visible grabber (a drag down closes it, as on any iPhone), the sticker style's
/// 30pt corners, and a white background unless the content draws its own paper.
extension View {
    func stickerSheet(white: Bool = true) -> some View {
        modifier(SheetChrome(white: white))
    }

    /// The sheet is as tall as its content (and scrolls when that is more than fits). Put it on the content, before `stickerSheet`.
    func fitsSheetHeight() -> some View {
        modifier(FitsSheetHeight())
    }
}

private struct SheetChrome: ViewModifier {
    let white: Bool

    func body(content: Content) -> some View {
        if white {
            content.presentationBackground(Tokens.Colors.white).presentationCornerRadius(30).presentationDragIndicator(.visible)
        } else {
            content.presentationCornerRadius(30).presentationDragIndicator(.visible)
        }
    }
}

private struct FitsSheetHeight: ViewModifier {
    /// Until the content is measured.
    @State private var height: CGFloat = 480

    /// The content sits in a scroll view that only scrolls when it does not fit: the sheet is as tall as the content, and
    /// when the content is taller than the screen allows (a small phone, the largest text size) the sheet stops at its
    /// largest height and the content scrolls instead of being cut off.
    func body(content: Content) -> some View {
        ScrollView {
            content.onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .presentationDetents([.height(height)])
    }
}
