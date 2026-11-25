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
    @Environment(\.dynamicTypeSize) private var textSize

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
            buttons
        }
        .padding(EdgeInsets(top: 28, leading: 22, bottom: 16, trailing: 22))
        .frame(maxWidth: .infinity)
        .fitsSheetHeight()
        .stickerSheet()
        .environment(\.layoutDirection, .rightToLeft)
    }

    /// Side by side only when every label fits in half the row on one line (and the text is not one of the accessibility
    /// sizes); otherwise stacked, the safe button first. No label is ever cut.
    @ViewBuilder private var buttons: some View {
        if textSize >= .accessibility1 {
            stacked
        } else {
            ViewThatFits(in: .horizontal) {
                EqualPair(spacing: 12) { cancelButton(oneLine: true); confirmButton(oneLine: true) }
                stacked
            }
        }
    }

    private var stacked: some View {
        VStack(spacing: 12) { cancelButton(oneLine: false); confirmButton(oneLine: false) }
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

/// Two buttons of the same width in a right-to-left row (the first on the right). It reports twice the widest button as
/// its natural width, so `ViewThatFits` takes it only when the widest label fits in half of the row.
private struct EqualPair: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let widest = subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        let width = proposal.width ?? 2 * widest + spacing
        let half = max(0, (width - spacing) / 2)
        let height = subviews.map { $0.sizeThatFits(ProposedViewSize(width: half, height: nil)).height }.max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let half = max(0, (bounds.width - spacing) / 2)
        for (index, subview) in subviews.enumerated() {
            let x = bounds.maxX - half - CGFloat(index) * (half + spacing)
            subview.place(at: CGPoint(x: x, y: bounds.minY), anchor: .topLeading, proposal: ProposedViewSize(width: half, height: bounds.height))
        }
    }
}
