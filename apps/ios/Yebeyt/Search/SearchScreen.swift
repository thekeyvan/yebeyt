import SwiftUI

/// Search: poets, books and couplets (from the bundled books), in the row styles of the library.
struct SearchScreen: View {
    @Environment(PoetryStore.self) private var poetry
    @Environment(Library.self) private var library
    @Environment(CorpusStore.self) private var corpusStore
    @State private var query: String
    @State private var corpus: CoupletCorpus?
    /// The results of the settled query (nil while there is nothing to search for).
    @State private var results: SearchResults?
    @FocusState private var focused: Bool

    init(initial: String) {
        _query = State(initialValue: initial)
    }

    /// What the results depend on: the text, and whether the couplets have loaded.
    private struct Search: Hashable {
        var query: String
        var loaded: Bool
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    BackButton()
                    SearchBox(text: $query, placeholder: "شاعر، شعر یا یه تیکه از بیت…", style: .round, focus: $focused)
                }
                .padding(.bottom, 6)
                if let results {
                    if corpus != nil, results.isEmpty { NothingFound() } else { resultSections(results) }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task {
            focused = true
            corpus = await corpusStore.corpus(poetry: poetry, library: library)
        }
        .task(id: Search(query: query, loaded: corpus != nil)) {
            // Searching on every key press would redo the work for text that is already gone.
            guard !TextNormalizer.normalize(query).isEmpty else { results = nil; return }
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            results = library.search(query, corpus: corpus)
        }
    }

    @ViewBuilder private func resultSections(_ results: SearchResults) -> some View {
        if !results.poets.isEmpty {
            heading("شاعرها")
            ForEach(results.poets) { poet in
                NavigationLink(value: Destination.poet(poet.slug)) { PoetRow(poet: poet) }.buttonStyle(.plain)
            }
        }
        if !results.books.isEmpty {
            heading("کتاب‌ها")
            ForEach(results.books) { book in
                NavigationLink(value: Destination.book(book.id)) { BookRow(book: book, poetName: library.poet(of: book)?.name ?? "") }
                    .buttonStyle(.plain)
            }
        }
        if !results.couplets.isEmpty {
            heading("بیت‌ها")
            ForEach(results.couplets) { CoupletRow(entry: $0) }
        }
    }

    private func heading(_ title: String) -> some View {
        Text(title).font(.title(20)).foregroundStyle(Tokens.Colors.ink).padding(.top, 10)
            .accessibilityAddTraits(.isHeader)
    }
}

private struct PoetRow: View {
    let poet: LibraryPoet

    var body: some View {
        HStack(spacing: 12) {
            PoetCircle(poet: poet, size: 40, border: 3)
            VStack(alignment: .leading, spacing: 0) {
                Text(poet.name).font(.ui(15, weight: .bold))
                Text(poet.tag).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            LineIcon(shape: ChevronLeftIcon(), size: 16, lineWidth: 2.4, fill: nil).foregroundStyle(Color(hex: 0x8A8698))
        }
        .foregroundStyle(Tokens.Colors.ink)
        .padding(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
        .listCard()
        .accessibilityElement(children: .combine)
    }
}

private struct BookRow: View {
    let book: LibraryBook
    let poetName: String

    var body: some View {
        HStack(spacing: 12) {
            BookCover(color: book.color).frame(width: 34)
            VStack(alignment: .leading, spacing: 0) {
                Text(book.title).font(.ui(14, weight: .bold)).lineLimit(2)
                Text(poetName).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            LineIcon(shape: ChevronLeftIcon(), size: 16, lineWidth: 2.4, fill: nil).foregroundStyle(Color(hex: 0x8A8698))
        }
        .foregroundStyle(Tokens.Colors.ink)
        .padding(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
        .listCard(radius: 20)
        .accessibilityElement(children: .combine)
    }
}
