import SwiftUI

/// A poet's page: follow, the card in the poet's colour, their books or sections, the game card and the most read poems.
struct PoetScreen: View {
    @Environment(AppModel.self) private var app
    @Environment(Library.self) private var library
    @Environment(Follows.self) private var follows
    let poet: LibraryPoet
    @State private var bioOpen = false
    @State private var top: TopPoems?

    /// The poet's most read poems of their main section.
    struct TopPoems {
        var heading: String
        var poems: [IndexedPoem]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                topRow
                hero
                chips
                gameCard
                if let top, !top.poems.isEmpty { topCard(top) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task { top = await loadTop() }
    }

    private var topRow: some View {
        HStack {
            BackButton()
            Spacer()
            let following = follows.contains(.poet(poet.slug))
            Button { follows.toggle(.poet(poet.slug)) } label: {
                Text(following ? "دنبال می‌کنی" : "دنبال کن")
                    .font(.ui(14, weight: .bold))
                    .foregroundStyle(following ? Tokens.Colors.ink : Tokens.Colors.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 7)
                    .sticker(fill: following ? Tokens.Colors.white : Tokens.Colors.lapis, radius: 999, border: 3, shadow: ShadowToken(y: 2, blur: 8, opacity: 0.22))
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(following ? .isSelected : [])
            .accessibilityIdentifier("follow")
        }
    }

    // MARK: The card

    /// How much taller Lalezar's line box is than its size at 64: trimmed so the name takes 64 per line, as on the board.
    private static let lalezarSpare: CGFloat = {
        let font = UIFont(name: Tokens.Fonts.title.postScript, size: 64)
        return max((font?.lineHeight ?? 64) - 64, 0)
    }()

    private var hero: some View {
        let on = poet.color.onColor
        return VStack(alignment: .leading, spacing: 6) {
            Text(poet.name)
                .font(.title(64))
                .lineSpacing(-Self.lalezarSpare)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, -Self.lalezarSpare / 2)  // the board's line-height 1: Lalezar's own line box is taller
                .padding(.top, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.trailing, 110)  // keeps clear of the circle, which sits at the left
                .accessibilityAddTraits(.isHeader)
            if let place = poet.place {
                Text(place).font(.ui(14)).foregroundStyle(on.opacity(0.8))
            }
            Text(poet.bio)
                .font(.ui(14))
                .lineSpacing(14 * 0.8 - 5)
                .lineLimit(bioOpen ? nil : 3)
                .fixedSize(horizontal: false, vertical: true)
            Button { withAnimation(.snappy) { bioOpen.toggle() } } label: {
                HStack(spacing: 4) {
                    Text("بیشتر بخون").font(.ui(13, weight: .bold))
                    LineIcon(shape: ChevronDownIcon(), size: 12, lineWidth: 3, fill: nil).rotationEffect(.degrees(bioOpen ? 180 : 0))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(Capsule().fill(on.opacity(0.18)))
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
            .accessibilityAddTraits(bioOpen ? .isSelected : [])
        }
        .foregroundStyle(on)
        .padding(EdgeInsets(top: 20, leading: 20, bottom: 18, trailing: 20))
        .frame(maxWidth: .infinity, alignment: .leading)
        .sticker(fill: poet.color.color, radius: 28, border: 5, shadow: ShadowToken(y: 4, blur: 14, opacity: 0.22))
        .overlay(alignment: .topTrailing) {
            PoetCircle(poet: poet, size: 96, border: 4, onCard: true).padding(21)
        }
        .overlay(alignment: .topLeading) {
            Text(poet.tag)
                .font(.title(15))
                .foregroundStyle(Tokens.Colors.ink)
                .padding(EdgeInsets(top: 5, leading: 11, bottom: 3, trailing: 11))
                .sticker(fill: Tokens.Colors.amber, radius: 999, border: 3, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.22))
                .tilted(6)
                .padding(.leading, 23)  // the board's right: 18, inside the card's 5pt border
                .offset(y: -9)  // and top: -14 from the inside of the border
                .allowsHitTesting(false)
        }
        .padding(.top, 8)
    }

    // MARK: Books and sections

    private struct Chip: Identifiable {
        var id: String
        var title: String
        var destination: Destination
    }

    /// The poet's books, or when there is only one, its sections.
    private var chipItems: [Chip] {
        let books = library.books(of: poet.slug)
        if let only = books.first, books.count == 1 {
            if let sections = only.sections, sections.count > 1 {
                return sections.map { Chip(id: "\($0.id)", title: $0.title, destination: .section(book: only.id, section: $0.id)) }
            }
        }
        return books.map { Chip(id: "\($0.id)", title: $0.title, destination: .book($0.id)) }
    }

    private var chips: some View {
        let items = chipItems
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { ForEach(items) { chip($0).frame(maxWidth: .infinity) } }
            ScrollView(.horizontal) {
                HStack(spacing: 8) { ForEach(items) { chip($0) } }.padding(.horizontal, 18).padding(.vertical, 4)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -18)
        }
    }

    private func chip(_ item: Chip) -> some View {
        NavigationLink(value: item.destination) {
            Text(item.title)
                .font(.ui(13, weight: .bold))
                .foregroundStyle(Tokens.Colors.ink)
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity)
                .background {
                    RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.10), radius: 4, x: 0, y: 2)
                }
        }
        .buttonStyle(.plain)
    }

    // MARK: The game card

    /// «بازی با بیت‌های حافظ»; it opens the بازی tab until the games exist (slice 3).
    private var gameCard: some View {
        Button { app.select(.games) } label: {
            HStack(spacing: 12) {
                LineIcon(shape: GamesIcon(), size: 22, lineWidth: 2.2, fill: nil)
                    .foregroundStyle(Tokens.Colors.white)
                    .frame(width: 42, height: 42)
                    .sticker(fill: Tokens.Colors.lapis, radius: 999, border: 3, shadow: ShadowToken(y: 0, blur: 0, opacity: 0))
                    .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 0) {
                    Text("بازی با بیت‌های \(poet.name)").font(.title(20)).lineLimit(1)
                    Text("یه دورِ ۱۰ سؤالی، فقط از \(poet.name)").font(.ui(12, weight: .medium)).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 4) {
                    Text("شروع").font(.ui(13, weight: .bold))
                    LineIcon(shape: ChevronLeftIcon(), size: 14, lineWidth: 3, fill: nil)
                }
                .foregroundStyle(Tokens.Colors.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Capsule().fill(Tokens.Colors.lapis))
            }
            .foregroundStyle(Tokens.Colors.ink)
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14))
            .sticker(fill: Tokens.Colors.amber, radius: 22, border: 5, shadow: ShadowToken(y: 3, blur: 10, opacity: 0.18))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gameCard")
    }

    // MARK: Most read

    private func loadTop() async -> TopPoems? {
        guard let book = library.mainBook(of: poet.slug), let index = try? await library.index(of: book) else { return nil }
        let section = book.mainSection
        let ranked = SectionList.sorted(index.poems(inAny: section.subtreeIds), by: .popularity).prefix(3).filter { $0.recitations > 0 }
        return TopPoems(heading: "پرخواننده‌ترین \(section.unit)\u{200C}ها", poems: Array(ranked))
    }

    private func topCard(_ top: TopPoems) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(top.heading).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).padding(.top, 10)
                .accessibilityAddTraits(.isHeader)
            ForEach(Array(top.poems.enumerated()), id: \.element.id) { offset, poem in
                Button { app.openReader(ReaderRoute(path: poem.path)) } label: {
                    HStack(spacing: 12) {
                        Text(PersianDigits.string(offset + 1))
                            .font(.ui(13, weight: .bold))
                            .foregroundStyle(Tokens.Colors.muted)
                            .frame(width: 30, height: 30)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Tokens.Colors.paper))
                        Text(TextNormalizer.plain(poem.first)).font(.poem(16)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        LineIcon(shape: ChevronLeftIcon(), size: 16, lineWidth: 2.6, fill: nil).foregroundStyle(Color(hex: 0xB9B4C6))
                    }
                    .padding(.vertical, 12)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("top-\(offset + 1)")
                if offset < top.poems.count - 1 { Divider().overlay(Tokens.Colors.chipBorder) }
            }
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 4)
        .background {
            RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 6, x: 0, y: 3)
        }
    }
}
