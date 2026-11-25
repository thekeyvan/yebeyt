import SwiftUI
import UIKit

/// Closing the keyboard from one place: when a cover or a sheet opens, when the phone is shaken, and when a tap lands
/// outside the field being written in.
@MainActor
enum Keyboard {
    /// The field or text view being written in goes out of focus (whoever it is, wherever it is); the keyboard goes with it.
    @discardableResult static func dismiss() -> Bool {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    /// A tap at `point` (in window coordinates): dismisses unless it is on the field that has the focus, so a tap into a
    /// field never closes it.
    static func dismiss(tappingAt point: CGPoint) {
        guard !shouldKeep(tapAt: point, field: focusedFieldFrame()) else { return }
        dismiss()
    }

    /// A tap inside the focused field's frame keeps the keyboard; any other tap (or no field at all) does not.
    nonisolated static func shouldKeep(tapAt point: CGPoint, field: CGRect?) -> Bool {
        field?.contains(point) == true
    }

    /// The box of the text field or text view that is the first responder, as drawn, in window coordinates (the capsule it is
    /// typed in, when it has one, not only the line of text; see `FeedbackPrivacy.box`); nil when none is.
    static func focusedFieldFrame() -> CGRect? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let window = scenes.flatMap(\.windows).first(where: \.isKeyWindow) else { return nil }
        func focused(_ view: UIView) -> UIView? {
            if view.isFirstResponder, view is UITextInput { return view }
            return view.subviews.lazy.compactMap(focused).first
        }
        guard let field = focused(window) else { return nil }
        return FeedbackPrivacy.shared.box(around: field.drawnFrame(in: window), in: window)
    }
}

extension View {
    /// A tap on this view, outside the field being written in, closes the keyboard. The tap still reaches what is under
    /// it (buttons, links). Not for a composer, whose send button keeps the keyboard.
    func dismissesKeyboardOnTap() -> some View {
        simultaneousGesture(SpatialTapGesture(coordinateSpace: .global).onEnded { Keyboard.dismiss(tappingAt: $0.location) })
    }

    /// Scrolling closes the keyboard (with the finger, as in Messages) and so does a tap outside the field.
    func dismissesKeyboard() -> some View {
        scrollDismissesKeyboard(.interactively).dismissesKeyboardOnTap()
    }
}
