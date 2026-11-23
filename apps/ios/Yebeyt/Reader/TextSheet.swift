import SwiftUI

/// The «آ» sheet: size, font, weight, hemistich layout, line spacing and theme. Every change applies at once
/// to the reader behind it and is kept on the phone.
struct TextSheet: View {
    @Environment(TextSettingsStore.self) private var store
    let close: () -> Void

    private var bindable: Bindable<TextSettingsStore> { Bindable(store) }

    var body: some View {
        VStack(spacing: 14) {
            Capsule().fill(Tokens.Colors.ring).frame(width: 40, height: 5)
            HStack {
                Text("متن").font(.title(22)).foregroundStyle(Tokens.Colors.ink)
                Spacer()
                Button("تمام", action: close)
                    .font(.ui(14, weight: .bold))
                    .foregroundStyle(Tokens.Colors.lapis)
            }
            SizeSlider(size: bindable.settings.size)
            fontChips
            weightRow
            layoutRow
            spacingRow
            themeRow
        }
        .padding(EdgeInsets(top: 10, leading: 20, bottom: 28, trailing: 20))
        .frame(maxWidth: .infinity)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 30, topTrailingRadius: 30)
                .fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.16), radius: 12, x: 0, y: -6)
                .ignoresSafeArea(edges: .bottom)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("تنظیم متن")
    }

    private var fontChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(ReaderFont.allCases, id: \.self) { font in
                    let chosen = store.settings.font == font
                    Button { store.settings.font = font } label: {
                        VStack(spacing: 0) {
                            Text("بیت")
                                .font(.custom(font.postScript(bold: true), fixedSize: 21 * font.glyphScale))
                                .frame(height: 21 * 1.7)
                                .foregroundStyle(Tokens.Colors.ink)
                            Text(font.title)
                                .font(.ui(11, weight: chosen ? .bold : .medium, scaled: false))
                                .foregroundStyle(chosen ? Tokens.Colors.lapis : Tokens.Colors.muted)
                        }
                        .frame(width: 72)
                        // The board's chip: 72pt of content, 4pt padding and a 3pt border each side, so 86pt in all.
                        .padding(EdgeInsets(top: 6 + 3, leading: 4 + 3, bottom: 5 + 3, trailing: 4 + 3))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(chosen ? Tokens.Colors.lapis : Tokens.Colors.chipBorder, lineWidth: 3))
                        .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.white))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(font.title)
                    .accessibilityAddTraits(chosen ? .isSelected : [])
                }
            }
            .padding(.bottom, 2)
        }
        .scrollIndicators(.hidden)
    }

    private var weightRow: some View {
        SegmentedRow(title: "وزن قلم", options: [false, true], selection: bindable.settings.bold, label: { $0 ? "پررنگ" : "معمولی" }) { bold in
            Text("بیت").font(.custom(ReaderFont.parastoo.postScript(bold: bold), fixedSize: 18 * ReaderFont.parastoo.glyphScale))
        }
        .disabled(!store.settings.canChooseWeight)
        .opacity(store.settings.canChooseWeight ? 1 : 0.4)
    }

    private var layoutRow: some View {
        SegmentedRow(title: "چینش مصراع‌ها", options: HemistichLayout.allCases, selection: bindable.settings.layout, label: \.title) { layout in
            VStack(spacing: 3) {
                RoundedRectangle(cornerRadius: 2).frame(width: 14, height: 3)
                    .frame(width: 22, alignment: layout == .staggered ? .leading : .center)
                RoundedRectangle(cornerRadius: 2).frame(width: 14, height: 3)
                    .frame(width: 22, alignment: layout == .staggered ? .trailing : .center)
            }
        }
    }

    private var spacingRow: some View {
        SegmentedRow(title: "فاصله‌ی خط‌ها", options: TextSpacing.allCases, selection: bindable.settings.spacing, label: \.title) { _ in EmptyView() }
    }

    private var themeRow: some View {
        HStack(spacing: 8) {
            ForEach(ReaderTheme.allCases, id: \.self) { theme in
                let chosen = store.settings.theme == theme
                Button { store.settings.theme = theme } label: {
                    HStack(spacing: 8) {
                        Text("آ").font(.custom(ReaderFont.parastoo.postScript(bold: true), fixedSize: 18 * ReaderFont.parastoo.glyphScale))
                        Text(theme.title).font(.ui(13, weight: chosen ? .bold : .medium, scaled: false))
                    }
                    .foregroundStyle(theme.foreground)
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(RoundedRectangle(cornerRadius: 14).fill(theme.background))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(chosen ? Tokens.Colors.lapis : Tokens.Colors.trackLight, lineWidth: 3))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(theme.title)
                .accessibilityAddTraits(chosen ? .isSelected : [])
            }
        }
    }
}

/// A titled group of options in a light pill: the chosen one is lapis with white text.
private struct SegmentedRow<Value: Hashable, Leading: View>: View {
    let title: String
    let options: [Value]
    @Binding var selection: Value
    let label: (Value) -> String
    @ViewBuilder let leading: (Value) -> Leading

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.ui(13, weight: .bold, scaled: false)).foregroundStyle(Tokens.Colors.muted)
            HStack(spacing: 4) {
                ForEach(options, id: \.self) { option in
                    let chosen = selection == option
                    Button { selection = option } label: {
                        HStack(spacing: 6) {
                            leading(option)
                            Text(label(option)).font(.ui(13, weight: chosen ? .bold : .medium, scaled: false))
                        }
                        .foregroundStyle(chosen ? Tokens.Colors.white : Tokens.Colors.ink)
                        .frame(maxWidth: .infinity)
                        .frame(height: 38)
                        .background(RoundedRectangle(cornerRadius: 12).fill(chosen ? Tokens.Colors.lapis : .clear))
                        .contentShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(label(option))
                    .accessibilityAddTraits(chosen ? .isSelected : [])
                }
            }
            .padding(4)
            .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.paper))
            .accessibilityElement(children: .contain)
            .accessibilityLabel(title)
        }
    }
}

/// The size slider: small «آ» at the start, large at the end; the thumb moves towards the large one.
private struct SizeSlider: View {
    @Binding var size: Int

    private var fraction: Double {
        Double(size - TextSettings.sizes.lowerBound) / Double(TextSettings.sizes.upperBound - TextSettings.sizes.lowerBound)
    }

    var body: some View {
        HStack(spacing: 12) {
            Text("آ").font(.custom(Tokens.Fonts.poem.postScript, fixedSize: 15 * Tokens.Fonts.poem.sizeAdjust))
            track
            Text("آ").font(.custom(Tokens.Fonts.poem.postScript, fixedSize: 26 * Tokens.Fonts.poem.sizeAdjust))
        }
        .foregroundStyle(Tokens.Colors.ink)
    }

    /// Drawn left to right inside, so x is the physical position; the large end is at the left.
    private var track: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            ZStack(alignment: .leading) {
                Capsule().fill(Tokens.Colors.trackLight).frame(height: 6)
                Capsule().fill(Tokens.Colors.lapis).frame(width: width * fraction, height: 6)
                    .offset(x: width * (1 - fraction))
                Circle().fill(Tokens.Colors.white)
                    .overlay(Circle().strokeBorder(Tokens.Colors.lapis, lineWidth: 4))
                    .frame(width: 24, height: 24)
                    .shadow(color: Tokens.Colors.ink.opacity(0.25), radius: 3, x: 0, y: 2)
                    .offset(x: width * (1 - fraction) - 12)
            }
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { drag in
                let value = 1 - min(max(drag.location.x / width, 0), 1)
                let range = TextSettings.sizes
                size = range.lowerBound + Int((value * Double(range.upperBound - range.lowerBound)).rounded())
            })
        }
        .frame(height: 24)
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("اندازه‌ی حروف")
        .accessibilityValue(PersianDigits.string(size))
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: size += 1
            case .decrement: size -= 1
            @unknown default: break
            }
        }
        .accessibilityIdentifier("sizeSlider")
    }
}
