import SwiftUI

/// The one question the app asks before something that loses progress or can't be undone (the rule is in
/// docs/yebeyt-2.md): a title, an optional line under it, the safe button (grey, first, so on the right in
/// right-to-left) and the red one that does it. The identifiers are `<prefix>Title`, `<prefix>Message`,
/// `<prefix>Cancel` and `<prefix>Confirm`.
struct ConfirmSheet: View {
    let title: String
    let message: String?
    /// The red button: «بلاک کن», «حذف کن», «برو بیرون».
    let confirm: String
    /// The safe button, which keeps things as they are: «نه», «بمون».
    var cancel = "نه"
    let prefix: String
    @Binding var isPresented: Bool
    let action: () async -> Void
    @State private var busy = false

    var body: some View {
        VStack(spacing: 16) {
            Text(title).font(.title(24)).foregroundStyle(Tokens.Colors.ink).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("\(prefix)Title")
            if let message {
                Text(message).font(.ui(14)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("\(prefix)Message")
            }
            // Side by side; when a word would break (the largest text size), stacked with the safe button first.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { cancelButton(oneLine: true); confirmButton(oneLine: true) }
                VStack(spacing: 12) { cancelButton(oneLine: false); confirmButton(oneLine: false) }
            }
        }
        .padding(EdgeInsets(top: 28, leading: 22, bottom: 16, trailing: 22))
        .frame(maxWidth: .infinity)
        .fitsSheetHeight()
        .stickerSheet()
        .environment(\.layoutDirection, .rightToLeft)
    }

    private func cancelButton(oneLine: Bool) -> some View {
        Button { isPresented = false } label: { Text(cancel).lineLimit(oneLine ? 1 : nil).frame(maxWidth: .infinity) }
            .buttonStyle(.sticker(.secondary))
            .accessibilityLabel(cancel)
            .accessibilityIdentifier("\(prefix)Cancel")
    }

    private func confirmButton(oneLine: Bool) -> some View {
        Button {
            busy = true
            Task {
                await action()
                busy = false
                isPresented = false
            }
        } label: { Text(confirm).lineLimit(oneLine ? 1 : nil).frame(maxWidth: .infinity) }
            .buttonStyle(DangerButtonStyle())
            .disabled(busy)
            .accessibilityLabel(confirm)
            .accessibilityIdentifier("\(prefix)Confirm")
    }
}
