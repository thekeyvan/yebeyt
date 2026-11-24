import SwiftUI

/// A section of a book: its child sections, then its poems, searchable and sortable, with the read marks.
struct SectionScreen: View {
    @Environment(AppModel.self) private var app
    @Environment(Library.self) private var library
    @Environment(ReadingProgress.self) private var progress
    let book: LibraryBook
    let section: BookSection
    @State private var index: BookIndex?
    @State private var poems: [IndexedPoem] = []
    @State private var shown: [IndexedPoem] = []
    @State private var query = ""
    @State private var sort = SectionSort.number

    /// What the shown list depends on; `.task(id:)` recomputes it when this changes.
    private struct Listing: Hashable {
        var query: String
        var sort: SectionSort
        var count: Int
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                SearchBox(text: $query, placeholder: "یه کلمه یا شماره‌ی \(section.unit)…")
                    .padding(.top, 6)
                sortControl
                    .padding(.vertical, 6)
                if !section.children.isEmpty, TextNormalizer.normalize(query).isEmpty { childSections }
                ForEach(shown) { poem in
                    Button { app.openReader(ReaderRoute(path: poem.path)) } label: { PoemRow(poem: poem) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("poem-\(poem.number)")
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader { ScreenHeader(title: section.title, subtitle: subtitle) }
        .scrollDismissesKeyboard(.interactively)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task {
            index = try? await library.index(of: book)
            poems = index?.poems(in: section.id) ?? []
        }
        .task(id: Listing(query: query, sort: sort, count: poems.count)) {
            let (poems, query, sort) = (poems, query, sort)
            shown = await Task.detached { SectionList.sorted(SectionList.filtered(poems, query: query), by: sort) }.value
        }
    }

    /// «دیوان حافظ · ۴۹۵ غزل · ۲ تا خوندی»
    private var subtitle: String {
        let read = progress.readCount(in: poems.map(\.path))
        let parts = [book.title, "\(PersianDigits.string(section.count)) \(section.unit)", read > 0 ? "\(PersianDigits.string(read)) تا خوندی" : nil]
        return parts.compactMap { $0 }.joined(separator: " · ")
    }

    private var sortControl: some View {
        HStack(spacing: 10) {
            Text("ترتیب:").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.muted)
            HStack(spacing: 4) {
                ForEach(SectionSort.allCases, id: \.self) { kind in
                    let on = sort == kind
                    Button { sort = kind } label: {
                        Text(kind.title)
                            .font(.ui(13, weight: on ? .bold : .medium))
                            .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(RoundedRectangle(cornerRadius: 12).fill(on ? Tokens.Colors.lapis : .clear))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .padding(4)
            .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.trackLight))
            .accessibilityElement(children: .contain)
            .accessibilityLabel("ترتیب")
        }
    }

    private var childSections: some View {
        let reading = progress.last.flatMap { progress.isInProgress($0.path) ? index?.poem(path: $0.path)?.catId : nil }
        return VStack(spacing: 0) {
            ForEach(Array(section.children.enumerated()), id: \.element.id) { offset, child in
                NavigationLink(value: Destination.section(book: book.id, section: child.id)) {
                    SectionRow(section: child, isReading: reading.map(child.subtreeIds.contains) ?? false)
                }
                .buttonStyle(.plain)
                if offset < section.children.count - 1 { Divider().overlay(Tokens.Colors.paper) }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 2)
        .background {
            RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.06), radius: 5, x: 0, y: 2)
        }
        .padding(.bottom, 4)
    }
}

/// A poem in a section list: its number, the first line, the couplet count and the read mark. The poem in
/// progress is tinted.
private struct PoemRow: View {
    @Environment(ReadingProgress.self) private var progress
    let poem: IndexedPoem

    var body: some View {
        let reading = progress.isInProgress(poem.path)
        HStack(spacing: 12) {
            Text(PersianDigits.string(poem.number))
                .font(.title(16, scaled: false))
                .foregroundStyle(reading ? Tokens.Colors.white : Tokens.Colors.ink)
                .padding(.top, 3)
                .frame(width: 36, height: 36)
                .background(RoundedRectangle(cornerRadius: 12).fill(reading ? Tokens.Colors.lapis : Tokens.Colors.paper))
            VStack(alignment: .leading, spacing: 2) {
                Text(TextNormalizer.plain(poem.first))
                    .font(.poem(16))
                    .foregroundStyle(Tokens.Colors.ink)
                    .lineLimit(1)
                    .frame(minHeight: 27, alignment: .leading)
                HStack(spacing: 8) {
                    Text("\(PersianDigits.string(poem.couplets)) بیت").font(.ui(11)).foregroundStyle(Color(hex: 0x8A8698))
                    if reading {
                        Text("داری می‌خونی").font(.ui(11, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                    } else if progress.isRead(poem.path) {
                        HStack(spacing: 3) {
                            LineIcon(shape: CheckIcon(), size: 16, lineWidth: 3, fill: nil).foregroundStyle(Tokens.Colors.green)
                            Text("خوندی").font(.ui(11, weight: .bold)).foregroundStyle(Color(hex: 0x3E9A1E))
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
        .listCard(fill: reading ? Tokens.Colors.lapisTint : Tokens.Colors.white)
        .contentShape(Rectangle())
    }
}
