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
                    .transition(.opacity)
                    .accessibilityIdentifier("feedbackToast")
            }
        }
        .frame(maxWidth: .infinity)
        .animation(.snappy, value: center.toast)
        .environment(\.layoutDirection, .rightToLeft)
        .environment(\.locale, Locale(identifier: "fa_IR"))
        .font(.ui(16))
    }
}

/// The content of the pill's window.
struct RecordingPillHost: View {
    let center: FeedbackCenter

    var body: some View {
        RecordingPill { Task { await center.stopRecording() } }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "fa_IR"))
            .font(.ui(16))
    }
}

/// A small fire sticker at the top: a dot, «در حال ضبط» and the «تموم» button.
struct RecordingPill: View {
    let stop: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(Tokens.Colors.white).frame(width: 9, height: 9)
            Text("در حال ضبط").font(.ui(13, weight: .bold))
            Text("·").font(.ui(13, weight: .bold))
            Button(action: stop) {
                Text("تموم").font(.ui(13, weight: .bold)).underline()
                    .padding(.vertical, 8).padding(.horizontal, 4)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("recordingStop")
        }
        .foregroundStyle(Tokens.Colors.white)
        .padding(.horizontal, 14).padding(.vertical, 0)
        .sticker(fill: Tokens.Colors.fire, radius: Tokens.Sticker.Radius.pill, border: Tokens.Sticker.BorderWidth.badge, shadow: Tokens.Sticker.Shadow.badge)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("recordingPill")
    }
}
