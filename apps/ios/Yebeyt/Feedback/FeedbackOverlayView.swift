import SwiftUI

/// The toast after sending («رسید، ممنون!»), over the whole app.
struct FeedbackToastView: View {
    let center: FeedbackCenter

    var body: some View {
        VStack {
            Spacer()
            if let toast = center.toast {
                Text(toast)
                    .font(.ui(13, weight: .medium))
                    .foregroundStyle(Tokens.Colors.white)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(Capsule().fill(Tokens.Colors.ink))
                    .padding(.bottom, 96)
                    .toastTransition()
                    .accessibilityIdentifier("feedbackToast")
            }
        }
        .frame(maxWidth: .infinity)
        .animation(Motion.bouncy, value: center.toast)
        .environment(\.layoutDirection, .rightToLeft)
        .environment(\.locale, Locale(identifier: "fa_IR"))
        .font(.ui(16))
    }
}

/// The content of the pill's window: the pill under the status bar, in the middle.
struct RecordingPillHost: View {
    let center: FeedbackCenter
    /// Where the pill is in the window, so that only there takes touches.
    let pillFrame: (CGRect) -> Void

    var body: some View {
        RecordingPill { Task { await center.stopRecording() } }
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { pillFrame($0) }
            .padding(.top, 4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "fa_IR"))
            .font(.ui(16))
    }
}

/// A small fire sticker at the top: a dot and «در حال ضبط · تموم». The whole pill is the stop button, with a hit area at
/// least 44pt tall; VoiceOver lands on it when it appears.
struct RecordingPill: View {
    let stop: () -> Void
    @AccessibilityFocusState private var focused: Bool

    var body: some View {
        ZStack { button }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("recordingPill")
    }

    private var button: some View {
        Button(action: stop) {
            HStack(spacing: 8) {
                Circle().fill(Tokens.Colors.white).frame(width: 9, height: 9)
                Text("در حال ضبط").font(.ui(13, weight: .bold))
                Text("·").font(.ui(13, weight: .bold))
                Text("تموم").font(.ui(13, weight: .bold)).underline()
            }
            .foregroundStyle(Tokens.Colors.white)
            .padding(.horizontal, 14).padding(.vertical, 8)
            .sticker(fill: Tokens.Colors.fire, radius: Tokens.Sticker.Radius.pill, border: Tokens.Sticker.BorderWidth.badge, shadow: Tokens.Sticker.Shadow.badge)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("ضبط رو تموم کن")
        .accessibilityIdentifier("recordingStop")
        .accessibilityFocused($focused)
        .onAppear { focused = true }
    }
}
