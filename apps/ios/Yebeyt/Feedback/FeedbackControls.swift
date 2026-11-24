import SwiftUI

// The pieces the feedback forms share (FeedbackBug, FeedbackGame boards).

extension Color {
    /// The quiet grey of hints and notes on the feedback boards.
    static let feedbackHint = Color(hex: 0x8A8698)
}

extension SegmentedStyle {
    static func feedback(vertical: CGFloat) -> SegmentedStyle {
        SegmentedStyle(track: Tokens.Colors.trackLight, trackRadius: 14, trackPadding: 4, itemRadius: 12, fontSize: 13, vertical: vertical, horizontal: nil, spacing: 4)
    }
}

/// The top row of a form: ×, the title and «بفرست».
struct FeedbackHeader: View {
    let title: String
    let canSend: Bool
    let close: () -> Void
    let send: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: close) {
                LineIcon(shape: CloseIcon(), size: 18, lineWidth: 2.6, fill: nil)
                    .foregroundStyle(Tokens.Colors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.1), radius: 4, x: 0, y: 2))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("بستن")
            .accessibilityIdentifier("feedbackClose")
            Text(title).font(.title(22)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            Button(action: send) {
                Text("بفرست").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                    .padding(.horizontal, 16).padding(.vertical, 7)
                    .background(Capsule().fill(Tokens.Colors.lapis))
                    .overlay(Capsule().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .shadow(color: Tokens.Colors.lapis.opacity(0.28), radius: 5, x: 0, y: 3)
                    .opacity(canSend ? 1 : 0.4)
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityIdentifier("feedbackSend")
        }
    }
}

/// «چی شد؟» with the small hint after it («اگه داره»).
struct FeedbackLabel: View {
    let title: String
    var hint: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(title).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
            if let hint { Text(hint).font(.ui(11)).foregroundStyle(Color.feedbackHint) }
        }
        .accessibilityElement(children: .combine)
    }
}

/// A white box for several lines, with the lapis outline while it has the focus.
struct FeedbackTextArea: View {
    @Binding var text: String
    let minHeight: CGFloat
    var placeholder = ""
    /// What VoiceOver says; the placeholder when there is no other.
    var label: String?
    let id: String
    var disabled = false
    @FocusState private var focused: Bool

    var body: some View {
        TextEditor(text: $text)
            .font(.ui(14))
            .lineSpacing(5)
            .scrollContentBackground(.hidden)
            .foregroundStyle(Tokens.Colors.ink)
            .focused($focused)
            .disabled(disabled)
            .onAppear { focused = true }
            .padding(.horizontal, 10).padding(.vertical, 4)
            .frame(minHeight: minHeight)
            .overlay(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder).font(.ui(14)).foregroundStyle(Color.feedbackHint)
                        .padding(.horizontal, 15).padding(.vertical, 12)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.white))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Tokens.Colors.lapis, lineWidth: focused ? 2 : 0))
            .onChange(of: text) { _, new in
                if new.count > FeedbackDraft.textLimit { text = String(new.prefix(FeedbackDraft.textLimit)) }
            }
            .accessibilityLabel(label ?? placeholder)
            .accessibilityIdentifier(id)
    }
}

/// The board's 44×26 switch, lapis when on.
struct FeedbackSwitchStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            Capsule()
                .fill(configuration.isOn ? Tokens.Colors.lapis : Tokens.Colors.ring)
                .frame(width: 44, height: 26)
                .overlay(alignment: configuration.isOn ? .trailing : .leading) {
                    Circle().fill(Tokens.Colors.white).frame(width: 20, height: 20).padding(3)
                }
                .animation(.snappy(duration: 0.15), value: configuration.isOn)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isToggle)
        .accessibilityValue(configuration.isOn ? "روشن" : "خاموش")
    }
}

/// The small red line under a form when sending did not go through.
struct FeedbackFailureLine: View {
    let line: String

    var body: some View {
        Text(line).font(.ui(12.5, weight: .medium)).foregroundStyle(Tokens.Colors.fire)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("feedbackFailure")
    }
}
