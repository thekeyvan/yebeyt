import SwiftUI

/// «معنی»: the couplet's meaning on a white card. Longer than three lines, it shows «بیشتر بخون» which opens the rest in place.
struct MeaningCard: View {
    let text: String
    @Binding var expanded: Bool
    let close: () -> Void

    @State private var fullHeight: CGFloat = 0
    @State private var shownHeight: CGFloat = 0

    private var isCut: Bool { !expanded && fullHeight > shownHeight + 1 }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("معنی").font(.title(20)).foregroundStyle(Tokens.Colors.ink)
                Spacer()
                Button(action: close) {
                    LineIcon(shape: CloseIcon(), size: 14, lineWidth: 3, fill: nil)
                        .foregroundStyle(Tokens.Colors.ink)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(Tokens.Colors.paper))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, -6)
                .accessibilityLabel("بستن معنی")
            }
            Text(text)
                .font(.ui(15))
                .lineSpacing(Self.extraSpacing)
                .foregroundStyle(Tokens.Colors.ink)
                .lineLimit(expanded ? nil : 3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .reportHeight($shownHeight)
                .background(alignment: .top) {
                    Text(text)
                        .font(.ui(15))
                        .lineSpacing(Self.extraSpacing)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .hidden()
                        .reportHeight($fullHeight)
                }
            if isCut {
                Button("بیشتر بخون") { withAnimation(.snappy) { expanded = true } }
                    .font(.ui(13, weight: .bold))
                    .foregroundStyle(Tokens.Colors.lapis)
            }
        }
        .padding(EdgeInsets(top: 18, leading: 18, bottom: 16, trailing: 18))
        .background {
            RoundedRectangle(cornerRadius: 24)
                .fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.10), radius: 11, x: 0, y: 6)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("معنی")
    }

    /// The board's line height is 1.95 times the 15pt text.
    private static var extraSpacing: CGFloat {
        15 * 1.95 - (UIFont(name: Tokens.Fonts.ui.postScript, size: 15)?.lineHeight ?? 15 * 1.6)
    }
}

private extension View {
    func reportHeight(_ height: Binding<CGFloat>) -> some View {
        background {
            GeometryReader { proxy in
                Color.clear
                    .onAppear { height.wrappedValue = proxy.size.height }
                    .onChange(of: proxy.size.height) { _, new in height.wrappedValue = new }
            }
        }
    }
}
