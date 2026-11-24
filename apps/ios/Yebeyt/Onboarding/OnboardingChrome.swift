import SwiftUI

/// The big lapis button at the bottom of an onboarding screen: «بزن بریم», «بعدی», «همینه».
struct OnbButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title(22))
            .foregroundStyle(Tokens.Colors.white)
            .padding(.top, 4)
            .frame(maxWidth: .infinity, minHeight: 50, maxHeight: 50)
            .sticker(fill: Tokens.Colors.lapis, radius: 20, border: 4, shadow: ShadowToken(y: 6, blur: 16, opacity: 0.3))
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.45)
            .pressSquish(configuration.isPressed)
    }
}

/// «سلیقه · اولین بازی · حساب» and «رد شو» at the end.
struct OnbTopBar: View {
    static let labels = ["سلیقه", "اولین بازی", "حساب"]

    let current: Int
    let skip: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            HStack(spacing: 6) {
                ForEach(Self.labels.indices, id: \.self) { index in
                    VStack(alignment: .leading, spacing: 5) {
                        RoundedRectangle(cornerRadius: 3).fill(index <= current ? Tokens.Colors.lapis : Tokens.Colors.ring).frame(height: 6)
                        Text(Self.labels[index])
                            .font(.ui(11, weight: index == current ? .bold : .medium))
                            .foregroundStyle(index == current ? Tokens.Colors.ink : Color(hex: 0x8A8698))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("مرحله‌ی \(PersianDigits.string(current + 1)) از ۳، \(Self.labels[current])")
            Button(action: skip) {
                Text("رد شو").font(.ui(13, weight: .bold)).foregroundStyle(Color(hex: 0x8A8698))
                    .frame(minHeight: 28)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("onbSkip")
        }
    }
}

/// A title and the line under it, as on every onboarding screen: Lalezar 30 and a 13pt line.
struct OnbHeading: View {
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.title(30)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
            Text(text).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).lineSpacing(4)
        }
    }
}

extension View {
    /// An onboarding page: the board's side margins on dotted paper.
    func onbPage() -> some View {
        padding(.horizontal, 22).padding(.top, 6).padding(.bottom, 8).dottedPaper()
    }
}
