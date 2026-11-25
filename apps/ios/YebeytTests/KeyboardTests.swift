import Testing
import UIKit
@testable import Yebeyt

@MainActor
struct KeyboardTests {
    /// A field in the app's own key window (the one `UIApplication` sends actions through).
    private func focusedField() -> (UIWindow, UITextField)? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let window = scenes.flatMap(\.windows).first(where: \.isKeyWindow) else { return nil }
        let field = UITextField(frame: CGRect(x: 20, y: 600, width: 300, height: 44))
        window.addSubview(field)
        _ = field.becomeFirstResponder()
        return (window, field)
    }

    @Test func dismissTakesTheFocusFromTheFieldWhoeverHasIt() {
        guard let (_, field) = focusedField() else { Issue.record("no key window"); return }
        defer { field.removeFromSuperview() }
        #expect(field.isFirstResponder)
        Keyboard.dismiss()
        #expect(!field.isFirstResponder)
    }

    @Test func aTapInsideTheFocusedFieldKeepsTheKeyboardAndAnyOtherTapDoesNot() {
        let frame = CGRect(x: 20, y: 600, width: 300, height: 44)
        #expect(Keyboard.shouldKeep(tapAt: CGPoint(x: 100, y: 620), field: frame))
        #expect(!Keyboard.shouldKeep(tapAt: CGPoint(x: 100, y: 300), field: frame))
        #expect(!Keyboard.shouldKeep(tapAt: CGPoint(x: 100, y: 620), field: nil))
    }

    @Test func aTapOutsideTheFieldDismissesAndATapInsideDoesNot() {
        guard let (_, field) = focusedField() else { Issue.record("no key window"); return }
        defer { field.removeFromSuperview() }
        let frame = Keyboard.focusedFieldFrame()
        #expect(frame == field.frame)
        Keyboard.dismiss(tappingAt: CGPoint(x: 100, y: 620))
        #expect(field.isFirstResponder)
        Keyboard.dismiss(tappingAt: CGPoint(x: 100, y: 100))
        #expect(!field.isFirstResponder)
    }
}
