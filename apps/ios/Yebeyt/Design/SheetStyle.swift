import SwiftUI

/// What every native sheet looks like: a visible grabber (a drag down closes it, as on any iPhone), the sticker style's
/// 30pt corners, and a white background unless the content draws its own paper.
extension View {
    func stickerSheet(white: Bool = true) -> some View {
        modifier(SheetChrome(white: white))
    }

    /// The sheet is as tall as its content. Put it on the content, before `stickerSheet`.
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

    func body(content: Content) -> some View {
        content
            .fixedSize(horizontal: false, vertical: true)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
            .presentationDetents([.height(height)])
    }
}
