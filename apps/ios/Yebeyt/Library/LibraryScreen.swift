import SwiftUI

/// All the books: search, «ادامه بده», type chips and a three-column grid.
struct LibraryScreen: View {
    @Environment(Library.self) private var library
    @Environment(ReadingProgress.self) private var progress
    @State private var type: BookType?
    @State private var query = ""

    private var shown: [LibraryBook] {
        library.books.filter { book in
            (type == nil || book.type == type)
                && (TextNormalizer.normalize(query).isEmpty || TextNormalizer.contains(book.title, query: query)
                    || library.poet(of: book).map { TextNormalizer.contains($0.name, query: query) } == true)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                SearchBox(text: $query, placeholder: "کتاب یا شاعر…")
                if let last = progress.last, let book = library.book(containing: last.path) {
                    ContinueCard(book: book, last: last)
                }
                chips
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14, alignment: .top), count: 3), spacing: 16) {
                    ForEach(shown) { book in
                        NavigationLink(value: Destination.book(book.id)) {
                            BookTile(book: book, poetName: library.poet(of: book)?.name ?? "")
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("book-\(book.id)")
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader {
            ScreenHeader(
                title: "کتابخونه",
                subtitle: "\(PersianDigits.string(library.books.count)) کتاب از \(PersianDigits.string(library.poetCount)) شاعر"
            )
        }
        .scrollDismissesKeyboard(.interactively)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
    }

    private var chips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                chip("همه", on: type == nil) { type = nil }
                ForEach(BookType.allCases, id: \.self) { kind in
                    chip(kind.chipTitle, on: type == kind) { type = kind }
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 2)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -18)
    }

    private func chip(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.ui(13, weight: on ? .bold : .medium))
                .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
                .padding(.horizontal, 13)
                .frame(height: 34)
                .background(Capsule().fill(on ? Tokens.Colors.ink : Tokens.Colors.white))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// «ادامه بده»: the book last read from, where it was left, and how far along it is.
private struct ContinueCard: View {
    @Environment(Library.self) private var library
    let book: LibraryBook
    let last: ReadingProgress.Last
    @State private var fraction = 0.0

    var body: some View {
        NavigationLink(value: Destination.book(book.id)) {
            HStack(spacing: 12) {
                BookCover(color: book.color).frame(width: 34)
                VStack(alignment: .leading, spacing: 5) {
                    Text("ادامه بده").font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                    Text("\(book.title) · \(last.title)").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
                    ProgressBar(fraction: fraction, height: 6, track: Tokens.Colors.trackLight, fill: Tokens.Colors.lapis)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(EdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14))
            .listCard(radius: 20)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("continue")
        .task(id: last.path) {
            fraction = (try? await library.index(of: book))?.fraction(of: last.path) ?? 0
        }
    }
}

/// A thin progress bar; a little is always visible once there is any progress.
struct ProgressBar: View {
    let fraction: Double
    let height: CGFloat
    let track: Color
    let fill: Color

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(track)
                Capsule().fill(fill).frame(width: fraction > 0 ? max(geometry.size.width * fraction, height) : 0)
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}
