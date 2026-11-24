import SwiftUI

/// What floats over the whole app: the recording pill «● در حال ضبط · تموم» and the toast after sending.
struct FeedbackOverlayView: View {
    let center: FeedbackCenter

    var body: some View {
        ZStack {
            if center.isRecording {
                VStack {
                    RecordingPill { Task { await center.stopRecording() } }
                        .padding(.top, 8)
                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
            if let toast = center.toast {
                VStack {
                    Spacer()
                    Text(toast)
                        .font(.ui(13, weight: .medium))
                        .foregroundStyle(Tokens.Colors.white)
                        .padding(.horizontal, 16).padding(.vertical, 9)
                        .background(Capsule().fill(Tokens.Colors.ink))
                        .padding(.bottom, 96)
                        .accessibilityIdentifier("feedbackToast")
                }
                .transition(.opacity)
            }
        }
        .animation(.snappy, value: center.isRecording)
        .animation(.snappy, value: center.toast)
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
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("recordingStop")
        }
        .foregroundStyle(Tokens.Colors.white)
        .padding(.horizontal, 14).padding(.vertical, 5)
        .sticker(fill: Tokens.Colors.fire, radius: Tokens.Sticker.Radius.pill, border: Tokens.Sticker.BorderWidth.badge, shadow: Tokens.Sticker.Shadow.badge)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("recordingPill")
    }
}
