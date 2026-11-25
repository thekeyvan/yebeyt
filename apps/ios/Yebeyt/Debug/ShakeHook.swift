#if DEBUG
import SwiftUI
import UIKit

/// Debug launch argument `-beytShakeButton 1`: a thin invisible strip on the screen's edge (identifier `debugShake`) that
/// delivers a shake to the key window the way the phone does (`motionEnded`), for UI tests: the simulator can't be
/// shaken from a test. Tapping it takes no focus, so a keyboard that is up stays up, as in a real shake.
private struct ShakeHook: ViewModifier {
    func body(content: Content) -> some View {
        content.overlay(alignment: .trailing) {
            if UserDefaults.standard.string(forKey: "beytShakeButton") == "1" {
                Button {
                    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
                    scenes.flatMap(\.windows).first(where: \.isKeyWindow)?.motionEnded(.motionShake, with: nil)
                } label: {
                    Color.white.opacity(0.01).frame(width: 14, height: 40)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("debug shake")
                .accessibilityIdentifier("debugShake")
            }
        }
    }
}

extension View {
    func debugShakeHook() -> some View { modifier(ShakeHook()) }
}
#endif
