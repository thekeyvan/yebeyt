import SwiftUI

/// The one drag-to-dismiss rule for a sheet we draw ourselves (native sheets have it built in): the sheet follows the
/// finger down and rubber-bands up; letting go past 30% of its height, or flicking down, dismisses it; anything less
/// springs back with `Motion.bouncy`.
enum SheetDrag {
    /// Past this share of the sheet's height, letting go dismisses.
    static let dismissFraction = 0.3
    /// Points per second downward: a flick dismisses at any distance.
    static let dismissVelocity = 800.0
    /// The most the sheet can be pulled up.
    static let stretch = 40.0

    static func shouldDismiss(translation: Double, velocity: Double, height: Double) -> Bool {
        guard translation > 0, height > 0 else { return false }
        return translation >= height * dismissFraction || velocity >= dismissVelocity
    }

    /// Where the sheet sits for a drag of `translation` points: down follows the finger, up gives less and less.
    static func offset(for translation: Double) -> Double {
        translation >= 0 ? translation : -stretch * (1 - exp(translation / stretch))
    }
}

extension View {
    /// Makes a sheet we draw ourselves follow a drag down. `dismiss` is what closing means for this sheet (the sheet
    /// stays where the finger left it, so `dismiss` has to remove it).
    func dragToDismiss(_ dismiss: @escaping () -> Void) -> some View {
        modifier(DragToDismiss(dismiss: dismiss))
    }

    /// The drag of a sheet that is moved elsewhere (the reader: only its header is a handle, so the content keeps its own
    /// scrolling and paging): `translation` is what the sheet's offset follows (`SheetDrag.offset(for:)`) and `height` the
    /// sheet's, for the 30% rule.
    func dragsSheet(translation: Binding<Double>, height: Double, dismiss: @escaping () -> Void) -> some View {
        simultaneousGesture(
            // In the screen's own space: the sheet moves with the finger, and a space that moves with it would count only half.
            DragGesture(minimumDistance: 8, coordinateSpace: .global)
                .onChanged { translation.wrappedValue = $0.translation.height }
                .onEnded { value in
                    if SheetDrag.shouldDismiss(translation: value.translation.height, velocity: value.velocity.height, height: height) {
                        dismiss()
                    } else {
                        withAnimation(Motion.bouncy) { translation.wrappedValue = 0 }
                    }
                }
        )
    }
}

private struct DragToDismiss: ViewModifier {
    let dismiss: () -> Void
    @State private var translation = 0.0
    @State private var height = 0.0

    func body(content: Content) -> some View {
        content
            .offset(y: SheetDrag.offset(for: translation))
            .onGeometryChange(for: Double.self) { $0.size.height } action: { height = $0 }
            .dragsSheet(translation: $translation, height: height, dismiss: dismiss)
    }
}
