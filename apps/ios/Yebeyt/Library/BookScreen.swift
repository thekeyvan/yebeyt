import SwiftUI

/// One book: cover, poet, where to start or continue, a random poem, the blurb and the sections.
struct BookScreen: View {
    @Environment(AppModel.self) private var app
    @Environment(Library.self) private var library
    @Environment(ReadingProgress.self) private var progress
    @Environment(Follows.self) private var follows
    let book: LibraryBook
    @State private var index: BookIndex?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                if let index { actions(index) }
                Text(book.blurb)
                    .font(.ui(13))
                    .lineSpacing(13 * 0.9 - 4)
                    .foregroundStyle(Tokens.Colors.muted)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
                sections
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader { topRow }
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task { index = try? await library.index(of: book) }
    }

    private var topRow: some View {
        HStack {
            BackButton()
            Spacer()
            let kept = follows.contains(.book(book.id))
            RoundButton(label: "نگه داشتن کتاب", action: { follows.toggle(.book(book.id)) }) {
                LineIcon(shape: BookmarkIcon(), size: 20, lineWidth: 2.2, fill: kept ? Tokens.Colors.ink : nil).foregroundStyle(Tokens.Colors.ink)
            }
            .accessibilityAddTraits(kept ? .isSelected : [])
        }
    }

    private var header: some View {
        HStack(alignment: .bottom, spacing: 16) {
            BookCover(color: book.color).frame(width: 112).tilted(-3)
            VStack(alignment: .leading, spacing: 8) {
                Text(book.title).font(.title(30)).foregroundStyle(Tokens.Colors.ink).lineLimit(3)
                    .accessibilityAddTraits(.isHeader)
                if let poet = library.poet(of: book) { poetChip(poet) }
                Text(book.meta).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            }
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func poetChip(_ poet: LibraryPoet) -> some View {
        NavigationLink(value: Destination.poet(poet.slug)) {
            HStack(spacing: 6) {
                PoetCircle(poet: poet, size: 26, border: 0)
                Text(poet.name).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
            }
            .padding(EdgeInsets(top: 3, leading: 4, bottom: 3, trailing: 12))
            .background(Capsule().fill(Tokens.Colors.white))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("poetChip")
    }

    // MARK: Continue, start and random

    private func actions(_ index: BookIndex) -> some View {
        HStack(spacing: 8) {
            primary(index)
            Button {
                if let poem = index.poems(inAny: book.mainSection.subtreeIds).randomElement() { app.openReader(ReaderRoute(path: poem.path)) }
            } label: {
                HStack(spacing: 6) {
                    LineIcon(shape: DiceIcon(), size: 18, lineWidth: 2.2, fill: nil)
                    Text("یه \(book.unit) تصادفی").font(.ui(14, weight: .bold))
                }
                .foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 14)
                .frame(maxHeight: .infinity)
                .background {
                    RoundedRectangle(cornerRadius: 20).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 4, x: 0, y: 2)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("random")
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    /// «ادامه: غزل ۳» with progress when this book is being read, else «شروع: غزل ۱».
    @ViewBuilder private func primary(_ index: BookIndex) -> some View {
        if let last = progress.last, library.book(containing: last.path)?.id == book.id {
            primaryCard("ادامه: \(last.title)", fraction: index.fraction(of: last.path) ?? 0, route: ReaderRoute(path: last.path, couplet: last.couplet))
        } else if let first = index.first(in: book.rows[0]) ?? index.poems.first {
            primaryCard("شروع: \(book.shortTitle(of: first))", fraction: nil, route: ReaderRoute(path: first.path))
        }
    }

    private func primaryCard(_ title: String, fraction: Double?, route: ReaderRoute) -> some View {
        Button { app.openReader(route) } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.ui(15, weight: .bold)).lineLimit(1)
                if let fraction {
                    ProgressBar(fraction: fraction, height: 5, track: Tokens.Colors.white.opacity(0.3), fill: Tokens.Colors.white)
                }
            }
            .foregroundStyle(Tokens.Colors.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(EdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14))
            .sticker(fill: Tokens.Colors.lapis, radius: 20, border: 4, shadow: ShadowToken(y: 4, blur: 12, opacity: 0.28))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("primary")
    }

    // MARK: Sections

    /// The section the poem in progress sits in.
    private func readingCat(_ index: BookIndex?) -> Int? {
        guard let path = progress.last?.path, progress.isInProgress(path) else { return nil }
        return index?.poem(path: path)?.catId
    }

    private var sections: some View {
        let reading = readingCat(index)
        let rows = book.rows
        let poems = book.poems ?? []
        return VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { offset, section in
                NavigationLink(value: Destination.section(book: book.id, section: section.id)) {
                    SectionRow(section: section, isReading: reading.map(section.subtreeIds.contains) ?? false)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("section-\(section.id)")
                if offset < rows.count - 1 || !poems.isEmpty { Divider().overlay(Tokens.Colors.paper) }
            }
            ForEach(poems) { poem in
                Button { app.openReader(ReaderRoute(path: poem.path)) } label: {
                    SectionRow(title: poem.title, detail: PersianDigits.string(1), isReading: false)
                }
                .buttonStyle(.plain)
                if poem.id != poems.last?.id { Divider().overlay(Tokens.Colors.paper) }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 2)
        .background {
            RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.06), radius: 5, x: 0, y: 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("بخش‌های کتاب")
    }
}

/// A row of the book's sections: the title, «۴۹۵ غزل», the «داری می‌خونی» badge and the chevron.
struct SectionRow: View {
    let title: String
    let detail: String
    let isReading: Bool

    init(section: BookSection, isReading: Bool) {
        self.init(title: section.title, detail: "\(PersianDigits.string(section.count)) \(section.unit)", isReading: isReading)
    }

    init(title: String, detail: String, isReading: Bool) {
        self.title = title
        self.detail = detail
        self.isReading = isReading
    }

    var body: some View {
        HStack(spacing: 10) {
            Text(title).font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
            Text(detail).font(.ui(12)).foregroundStyle(Color(hex: 0x8A8698))
            if isReading {
                Text("داری می‌خونی")
                    .font(.ui(11, weight: .bold))
                    .foregroundStyle(Tokens.Colors.lapis)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Tokens.Colors.lapisTint))
            }
            Spacer(minLength: 0)
            LineIcon(shape: ChevronLeftIcon(), size: 16, lineWidth: 2.4, fill: nil).foregroundStyle(Color(hex: 0x8A8698))
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }
}
