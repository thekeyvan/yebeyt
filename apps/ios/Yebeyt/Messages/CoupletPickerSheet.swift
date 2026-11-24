import SwiftUI

/// A couplet the picker offers: from the divan, or found in the bundled books.
private struct PickerItem: Identifiable, Equatable {
    let key: String
    let couplet: Couplet
    /// «حافظ · غزل ۳»
    let source: String

    var id: String { key }
}

/// Choose a couplet (from the divan, or by searching the bundled books), add a note if you like, and hand it on:
/// «بیت بفرست» in a chat, «یه بیت اضافه کن» in a shared divan.
struct CoupletPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ReaderMarks.self) private var marks
    @Environment(PoetryStore.self) private var store
    @Environment(Library.self) private var library
    @Environment(CorpusStore.self) private var corpus
    let title: String
    let action: String
    let choose: (_ key: String, _ note: String?) -> Void

    @State private var query = ""
    @State private var divan: [PickerItem] = []
    @State private var found: [PickerItem] = []
    @State private var selected: PickerItem?
    @State private var note = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.title(26)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader).padding(.top, 8)
            if let selected {
                chosen(selected)
            } else {
                SearchBox(text: $query, placeholder: "یه تیکه از بیت…", style: .round)
                    .accessibilityIdentifier("pickerSearch")
                list
            }
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .dottedPaper()
        .presentationDetents([.large])
        .task { await loadDivan() }
        .task(id: query) { await search() }
    }

    // MARK: The list

    @ViewBuilder private var list: some View {
        let searching = !TextNormalizer.normalize(query).isEmpty
        let items = searching ? found : divan
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if !searching {
                    Text("از دیوانت").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.muted)
                    if divan.isEmpty {
                        Text("دیوانت هنوز خالیه؛ بالا دنبال یه بیت بگرد.").font(.ui(14)).foregroundStyle(Tokens.Colors.muted)
                    }
                } else if found.isEmpty {
                    Text("چیزی پیدا نشد.").font(.ui(14)).foregroundStyle(Tokens.Colors.muted)
                }
                ForEach(items) { item in
                    Button { selected = item } label: { card(item) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("pick-\(item.key)")
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
    }

    private func card(_ item: PickerItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack(spacing: 0) {
                Text(item.couplet.m1).frame(maxWidth: .infinity, alignment: .leading)
                if !item.couplet.m2.isEmpty { Text(item.couplet.m2).frame(maxWidth: .infinity, alignment: .trailing) }
            }
            .font(.poem(16)).lineSpacing(6)
            .foregroundStyle(Tokens.Colors.ink)
            Text(item.source).font(.ui(11)).foregroundStyle(Color(hex: 0x8A8698))
        }
        .padding(EdgeInsets(top: 12, leading: 16, bottom: 10, trailing: 16))
        .meCard(radius: 20, shadow: 0.06)
    }

    // MARK: The one chosen

    private func chosen(_ item: PickerItem) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            card(item)
            TextField("", text: $note, prompt: Text("یه یادداشت (اختیاری)").foregroundStyle(Color(hex: 0x8A8698)))
                .font(.ui(15))
                .foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 16)
                .frame(height: 48)
                .background(Capsule().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.12)))
                .onChange(of: note) { _, new in if new.count > ChatModel.maxNoteLength { note = String(new.prefix(ChatModel.maxNoteLength)) } }
                .accessibilityIdentifier("pickerNote")
            HStack(spacing: 10) {
                Button(action) {
                    choose(item.key, note)
                    dismiss()
                }
                .buttonStyle(.sticker(.primary))
                .accessibilityIdentifier("pickerSend")
                Button("بیت دیگه") { selected = nil }
                    .font(.ui(14, weight: .bold))
                    .foregroundStyle(Tokens.Colors.lapis)
                    .padding(.horizontal, 8)
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: Sources

    private func loadDivan() async {
        let model = DivanModel()
        await model.load(marks.keptItems, using: store)
        divan = model.entries.map { PickerItem(key: $0.key, couplet: $0.couplet, source: Self.source(slug: $0.poetSlug, title: $0.title, store: store)) }
    }

    private func search() async {
        guard !TextNormalizer.normalize(query).isEmpty else { return found = [] }
        try? await Task.sleep(for: .milliseconds(250))  // typing goes on: a new query cancels this one
        guard !Task.isCancelled, let corpus = await corpus.corpus(poetry: store, library: library) else { return }
        found = corpus.search(query, limit: 30).map { PickerItem(key: $0.id, couplet: $0.couplet, source: Self.source(slug: $0.poet, title: $0.title, store: store)) }
    }

    private static func source(slug: String, title: String, store: PoetryStore) -> String {
        "\(store.poets.first { $0.slug == slug }?.nickname ?? slug) · \(title)"
    }
}
