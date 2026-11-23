import SwiftUI

/// The کاوش tab: search, the Hafez fal, moods, poets and the library shelf. «پرطرفدارها» stays hidden until friends exist.
struct ExploreView: View {
    @Environment(AppModel.self) private var app
    @Environment(Library.self) private var library

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("کاوش").font(.title(40)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                searchField
                FalCard()
                moods
                SectionHeading(title: "شاعرها", link: "همه", destination: .allPoets)
                    .padding(.top, 2)
                poets
                SectionHeading(title: "کتابخونه", link: "همه‌ی کتاب‌ها", destination: .library)
                shelf
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
    }

    /// Looks like the field of the board; a tap opens the search screen with the keyboard up.
    private var searchField: some View {
        NavigationLink(value: Destination.search("")) {
            HStack(spacing: 10) {
                LineIcon(shape: ExploreIcon(), size: 20, lineWidth: 2.4, fill: nil).foregroundStyle(Tokens.Colors.muted)
                Text("شاعر، شعر یا یه تیکه از بیت…").font(.ui(15)).foregroundStyle(Color(hex: 0x8A8698))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .frame(height: 50)
            .background {
                Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 5, x: 0, y: 2)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("جستجو")
        .accessibilityIdentifier("searchField")
    }

    private var moods: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(library.moods) { mood in
                    NavigationLink(value: Destination.mood(mood.key)) {
                        Text(mood.title)
                            .font(.ui(13, weight: .medium))
                            .foregroundStyle(Tokens.Colors.ink)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 6)
                            .background {
                                Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.10), radius: 3, x: 0, y: 2)
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 4)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -18)
    }

    private var poets: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(library.explorePoets) { poet in
                    NavigationLink(value: Destination.poet(poet.slug)) { PoetTile(poet: poet) }
                        .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 2)
            .padding(.bottom, 12)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -18)
    }

    /// The first three books of the curated list.
    private var shelf: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: 3), alignment: .center, spacing: 12) {
            ForEach(library.books.prefix(3)) { book in
                NavigationLink(value: Destination.book(book.id)) {
                    BookTile(book: book, poetName: library.poet(of: book)?.name ?? "", titleSize: 16)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("book-\(book.id)")
            }
        }
    }
}
