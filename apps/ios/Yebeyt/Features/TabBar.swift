import SwiftUI

/// The tab bar: the exact spec is `nav()` in design/canvas/gen_explore.py.
struct TabBar: View {
    let model: AppModel

    /// Bottom gap 18 + bar height 70: what pages must keep clear.
    static let footprint: CGFloat = 88

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                item(tab)
            }
        }
        .frame(height: 64)
        .padding(.top, 6)
        .background {
            RoundedRectangle(cornerRadius: Tokens.Sticker.Radius.tabBar)
                .fill(Tokens.Colors.white)
                .stickerShadow(Tokens.Sticker.Shadow.tabBar)
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 18)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("تب‌ها")
    }

    private func item(_ tab: Tab) -> some View {
        let on = model.selectedTab == tab
        return Button {
            model.select(tab)
        } label: {
            VStack(spacing: 3) {
                icon(tab, on: on)
                Text(tab.title).font(.ui(11, weight: on ? .bold : .medium, scaled: false))
                RoundedRectangle(cornerRadius: 2)
                    .fill(on ? Tokens.Colors.lapis : .clear)
                    .frame(width: 16, height: 3)
            }
            .foregroundStyle(on ? Tokens.Colors.lapis : Tokens.Colors.muted)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(alignment: .top) {
                if tab == .games { gamesButton(on: on).offset(y: -RaisedGamesButton.rise) }
            }
            .background { if tab != .games { Color.clear.contentShape(Rectangle()) } }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityValue(tab == .messages ? (model.unreadAccessibilityLabel ?? "") : "")
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    @ViewBuilder
    private func icon(_ tab: Tab, on: Bool) -> some View {
        switch tab {
        case .home:
            LineIcon(shape: HomeIcon(), size: 24, lineWidth: on ? 2.4 : 2, fill: on ? Tokens.Colors.lapis : nil)
        case .explore:
            LineIcon(shape: ExploreIcon(), size: 24, lineWidth: on ? 2.4 : 2, fill: on ? Tokens.Colors.lapis.opacity(0.18) : nil)
        case .messages:
            // Left-to-right inside, so the badge's top -6 / left -9 are physical, as on the board.
            ZStack(alignment: .topLeading) {
                LineIcon(shape: MessagesIcon(), size: 24, lineWidth: on ? 2.4 : 2, fill: on ? Tokens.Colors.lapis : nil)
                unreadBadge
            }
            .environment(\.layoutDirection, .leftToRight)
        case .games:
            Color.clear.frame(height: 26)  // the round button is drawn above, see `gamesButton`
        case .me:
            meAvatar(on: on)
        }
    }

    /// The raised round «بازی» button, drawn over the top of its item: its top sits 18pt above the bar
    /// (the board's margin-top of -30 on a 56pt circle). It is drawn in an overlay
    /// of the button's own label, so the part above the bar is tappable too (an `.offset` of the whole item
    /// would not be; see TabBarUITests). The other columns get a full-size hit area; the «بازی» column is the
    /// circle and its label, so the empty corners next to the circle stay dead.
    private func gamesButton(on: Bool) -> some View {
        let lapis = Tokens.Colors.lapis
        return Circle()
            .fill(on ? lapis : Tokens.Colors.white)
            .overlay(Circle().strokeBorder(on ? Tokens.Colors.white : Tokens.Colors.gameRing, lineWidth: on ? 4 : 3))
            .overlay(LineIcon(shape: GamesIcon(), size: 26, lineWidth: 2.2, fill: nil)
                .foregroundStyle(on ? Tokens.Colors.white : lapis))
            .stickerShadow(ShadowToken(y: on ? 3 : 2, blur: on ? 10 : 6, opacity: on ? 0.25 : 0.12))
            .frame(width: RaisedGamesButton.diameter, height: RaisedGamesButton.diameter)
    }

    private func meAvatar(on: Bool) -> some View {
        let ringWidth: CGFloat = on ? 2.5 : 1.5
        return Circle()
            .fill(Tokens.Colors.white)
            .overlay(LineIcon(shape: PersonIcon(), size: 20, lineWidth: 2, fill: nil))
            .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 2))
            .overlay(Circle().stroke(on ? Tokens.Colors.lapis : Tokens.Colors.ring, lineWidth: ringWidth).padding(-ringWidth / 2))
            .frame(width: 30, height: 30)
    }

    /// Fire badge at the icon's top-left corner (CSS top -6, left -9); hidden at zero.
    @ViewBuilder
    private var unreadBadge: some View {
        if let text = model.unreadBadgeText {
            Text(text)
                .font(.ui(10, weight: .bold, scaled: false))
                .foregroundStyle(Tokens.Colors.white)
                .frame(minWidth: 18, minHeight: 18)
                .background {
                    Capsule().fill(Tokens.Colors.fire)
                    Capsule().strokeBorder(Tokens.Colors.white, lineWidth: 2)
                }
                .fixedSize()
                .offset(x: -9, y: -6)
                .accessibilityHidden(true)
        }
    }
}

/// Where the raised «بازی» circle sits.
private enum RaisedGamesButton {
    static let diameter: CGFloat = 56
    /// How far the circle's top is above the item's frame (the bar's 6pt top padding + 18pt above the bar).
    static let rise: CGFloat = 24
}

/// A line icon in a 24-unit box drawn at `size`; the stroke width is in box units, as in the SVG.
private struct LineIcon<S: Shape>: View {
    let shape: S
    let size: CGFloat
    let lineWidth: CGFloat
    let fill: Color?

    var body: some View {
        ZStack {
            if let fill { shape.fill(fill) }
            shape.stroke(style: StrokeStyle(lineWidth: lineWidth * size / 24, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
    }
}
