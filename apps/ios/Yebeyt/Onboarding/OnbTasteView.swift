import SwiftUI

/// OnbTaste: the poets (multi-select, with check marks) and the moods the person likes. Kept on the phone;
/// «بیتِ امروز» prefers these poets.
struct OnbTasteView: View {
    @Environment(OnboardingModel.self) private var onboarding
    @Environment(Library.self) private var library
    @Environment(Taste.self) private var taste

    /// The nine poets of the board's grid: the first of the Explore row.
    private var poets: [LibraryPoet] { Array(library.explorePoets.prefix(9)) }

    var body: some View {
        OnbScreen {
            OnbTopBar(current: 0) { onboarding.next() }
        } content: { density in
            VStack(spacing: density.gap) {
                OnbHeading(title: "کدوم شاعرها رو دوست داری؟", text: "«بیت امروز»ت رو از روی همین انتخاب می‌کنیم. هر چند تا خواستی.")
                    .frame(maxWidth: .infinity, alignment: .leading)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: density.poetGridGap) {
                    ForEach(poets) { poet in tile(poet, size: density.poetSize) }
                }
                .padding(.horizontal, 10).padding(.vertical, density.poetGridPadding)
                .background { RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 11, x: 0, y: 6) }
                VStack(alignment: .leading, spacing: 8) {
                    Text("چه حالی رو بیشتر دوست داری؟").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                    WrapLayout(spacing: 8, lineSpacing: 8, centered: false) {
                        ForEach(TasteMood.allCases, id: \.self) { mood in moodChip(mood) }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } footer: {
            Button("بعدی") { onboarding.next() }
                .buttonStyle(OnbButtonStyle())
                .accessibilityIdentifier("onbNext")
        }
    }

    private func tile(_ poet: LibraryPoet, size: CGFloat) -> some View {
        let on = taste.poets.contains(poet.slug)
        return Button { taste.toggle(poet: poet.slug) } label: {
            VStack(spacing: 6) {
                PoetCircle(poet: poet, size: size, border: on ? 4 : 3, borderColor: on ? Tokens.Colors.lapis : Tokens.Colors.white)
                    .overlay(alignment: .bottomTrailing) { if on { check } }  // the physical left, as on the board
                Text(poet.name).font(.ui(13, weight: on ? .bold : .medium)).foregroundStyle(Tokens.Colors.ink)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(poet.name)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("poet-\(poet.slug)")
    }

    private var check: some View {
        Circle().fill(Tokens.Colors.lapis)
            .overlay { LineIcon(shape: CheckIcon(), size: 12, lineWidth: 3.6, fill: nil).foregroundStyle(Tokens.Colors.white) }
            .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
            .frame(width: 24, height: 24)
            .offset(x: -2)
    }

    private func moodChip(_ mood: TasteMood) -> some View {
        let on = taste.moods.contains(mood)
        return Button { taste.toggle(mood: mood) } label: {
            Text(mood.title)
                .font(.ui(13, weight: on ? .bold : .medium))
                .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
                .padding(.horizontal, 14).frame(height: 36)
                .background(Capsule().fill(on ? Tokens.Colors.lapis : Tokens.Colors.white))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("mood-\(mood.rawValue)")
    }
}
