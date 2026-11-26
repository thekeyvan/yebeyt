import SwiftUI

/// The big lapis button at the bottom of an onboarding screen: «بزن بریم», «بعدی», «همینه».
struct OnbButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title(22))
            .foregroundStyle(Tokens.Colors.white)
            .padding(.top, 4)
            .frame(maxWidth: .infinity, minHeight: 50)
            .sticker(fill: Tokens.Colors.lapis, radius: 20, border: 4, shadow: ShadowToken(y: 6, blur: 16, opacity: 0.3))
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.45)
            .pressSquish(configuration.isPressed)
    }
}

/// «سلیقه · اولین بازی · حساب» and «رد شو» at the end.
struct OnbTopBar: View {
    static let labels = ["سلیقه", "اولین بازی", "حساب"]
    /// A control at the top is 44 pt tall to touch; the screen's header gives that height back from its bottom padding.
    static let tapHeight: CGFloat = 44
    /// What the bar and its labels draw, without the touch area under «رد شو».
    static let drawnHeight: CGFloat = 28

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
                            .lineLimit(1).minimumScaleFactor(0.7)
                            .foregroundStyle(index == current ? Tokens.Colors.ink : Color(hex: 0x8A8698))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("مرحله‌ی \(PersianDigits.string(current + 1)) از ۳، \(Self.labels[current])")
            Button(action: skip) {
                Text("رد شو").font(.ui(13, weight: .bold)).foregroundStyle(Color(hex: 0x8A8698))
                    .padding(.top, 5)
                    .frame(minHeight: Self.tapHeight, alignment: .top)
                    .contentShape(Rectangle())
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

/// How tightly an onboarding step is set: `compact` is for screens too short for the board's sizes (an iPhone SE is
/// 667 pt tall), with less room between the parts and smaller pictures.
struct OnbDensity: Equatable {
    var compact = false
    /// The height of the part that scrolls, for a step that fills it (the welcome's picture).
    var room: CGFloat = 0

    /// The room between the parts of a step.
    var gap: CGFloat { compact ? 10 : 16 }
    /// A poet's picture in the taste grid.
    var poetSize: CGFloat { compact ? 56 : 72 }
    var poetGridPadding: CGFloat { compact ? 12 : 18 }
    var poetGridGap: CGFloat { compact ? 10 : 14 }
    var gameIconSize: CGFloat { compact ? 44 : 50 }
    /// The room above a game card, whose tag rises above its top edge.
    var cardTagRoom: CGFloat { compact ? 8 : 0 }
}

/// An onboarding page on dotted paper with the board's side margins: the header (skip, back) and the main button stay
/// where they are, and what is between them scrolls only when it is taller than the room (a small phone, a large text
/// size). `content` is given the density to set itself by.
struct OnbScreen<Header: View, Content: View, Footer: View>: View {
    /// The scrolling part is cut at its edges, so the shadows of the cards at its ends get their room inside it (taken
    /// from the gaps next to it).
    private static var shadowRoom: (top: CGFloat, bottom: CGFloat) { (4, 8) }

    @ViewBuilder let header: () -> Header
    @ViewBuilder let content: (OnbDensity) -> Content
    @ViewBuilder let footer: () -> Footer
    /// The tallest the screen has been, so the keyboard coming up does not change the density.
    @State private var tallest: CGFloat = 0

    var body: some View {
        GeometryReader { screen in
            let compact = CompactHeight.isCompact(max(tallest, screen.size.height))
            let density = OnbDensity(compact: compact)
            VStack(spacing: 0) {
                header().padding(.horizontal, 22).padding(.top, 6).padding(.bottom, max(0, density.gap - Self.shadowRoom.top - OnbTopBar.tapHeight + OnbTopBar.drawnHeight))
                GeometryReader { room in
                    ScrollView {
                        content(OnbDensity(compact: compact, room: room.size.height - Self.shadowRoom.top - Self.shadowRoom.bottom))
                            .padding(.horizontal, 22)
                            .padding(.top, Self.shadowRoom.top).padding(.bottom, Self.shadowRoom.bottom)
                            .frame(minHeight: room.size.height, alignment: .top)
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    .scrollIndicators(.hidden)
                    .dismissesKeyboard()
                }
                footer().padding(.horizontal, 22).padding(.top, density.gap - Self.shadowRoom.bottom).padding(.bottom, 8)
            }
            .onChange(of: screen.size.height, initial: true) { _, height in tallest = max(tallest, height) }
        }
        .dottedPaper()
    }
}
