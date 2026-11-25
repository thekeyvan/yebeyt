import SwiftUI

/// The bottom of PlayMosh: whose turn, the field for the couplet, the couplets of the divan and the books that start with
/// the letter, and «کم آوردم». A couplet picked or typed is matched with the bundled books here before it is sent.
struct MoshPanel: View {
    let state: MoshState
    @Binding var toast: String?
    @Environment(FriendGames.self) private var games
    @Environment(PoetryStore.self) private var store
    @Environment(Library.self) private var library
    @Environment(CorpusStore.self) private var corpus
    @Environment(ReaderMarks.self) private var marks
    @State private var typed = ""
    @State private var divan: [DivanEntry] = []
    @State private var books: [CoupletEntry] = []
    @State private var suggestions: [MoshCandidate] = []
    @State private var sending = false
    @State private var confirmingResign = false

    private static let suggestionLimit = 6

    var body: some View {
        VStack(spacing: 10) {
            turnRow
            if state.isMyTurn {
                field
                if !suggestions.isEmpty { suggestionList }
                Text("بیتی که خودت بنویسی رو با کتابخونه چک می‌کنیم؛ تکراری قبول نیست.")
                    .font(.ui(11.5)).foregroundStyle(Color(hex: 0x8A8698)).multilineTextAlignment(.center)
            }
        }
        .padding(EdgeInsets(top: 14, leading: 14, bottom: 26, trailing: 14))
        .frame(maxWidth: .infinity)
        .background(UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26).fill(Tokens.Colors.white.opacity(0.7)).ignoresSafeArea(edges: .bottom))
        .dismissesKeyboardOnTap()
        .padding(.horizontal, -18)
        .sheet(isPresented: $confirmingResign) {
            ConfirmSheet(title: "کم آوردی؟ بازی رو می‌بازی.", message: nil, confirm: "کم آوردم", prefix: "resign", isPresented: $confirmingResign) {
                toast = await games.resign(state.game.id)
            }
        }
        .task { await loadSources() }
        .task(id: SuggestionKey(typed: typed, letter: state.requiredLetter, used: state.usedKeys.count, divan: divan.count, books: books.count)) { refreshSuggestions() }
    }

    // MARK: Whose turn

    private var turnRow: some View {
        HStack(spacing: 8) {
            if state.isMyTurn, let letter = state.requiredLetter {
                Text("نوبت توئه، با").font(.ui(14, weight: .bold))
                Text(String(letter))
                    .font(.title(20)).padding(.top, 3).padding(.horizontal, 10)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Tokens.Colors.amber))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 3, x: 0, y: 2)
                    .accessibilityLabel("حرف \(letter)")
                    .accessibilityIdentifier("moshLetter")
                Text("شروع کن").font(.ui(14, weight: .bold))
            } else {
                Text(state.turnLine).font(.ui(14, weight: .bold)).accessibilityIdentifier("moshTurnLine")
            }
            Spacer(minLength: 0)
            Button("کم آوردم") { confirmingResign = true }
                .font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.fire)
                .accessibilityIdentifier("moshResign")
        }
        .foregroundStyle(Tokens.Colors.ink)
    }

    private var field: some View {
        TextField("", text: $typed, prompt: Text("بنویس یا از پیشنهادها بردار").font(.ui(12)).foregroundStyle(Color(hex: 0x8A8698)))
            .font(.poem(16))
            .foregroundStyle(Tokens.Colors.ink)
            .submitLabel(.send)
            .autocorrectionDisabled()
            .onSubmit { Task { await sendTyped() } }
            .padding(.horizontal, 14)
            .frame(height: 46)
            .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.white))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Tokens.Colors.lapis, lineWidth: 2))
            .accessibilityIdentifier("moshField")
    }

    // MARK: Suggestions

    private var suggestionList: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("از دیوانت و کتابخونه").font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.muted)
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(suggestions) { candidate in
                        Button { Task { await send(candidate) } } label: { card(candidate) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("moshSuggestion-\(candidate.key)")
                    }
                }
            }
            .scrollIndicators(.hidden)
            .frame(maxHeight: 190)
        }
    }

    private func card(_ candidate: MoshCandidate) -> some View {
        let poet = library.poet(slug: candidate.poetSlug)?.name ?? ""
        return VStack(alignment: .leading, spacing: 2) {
            Text(MoshLastLetter.prefixMarked(TextNormalizer.plain(candidate.couplet.m1), letters: max(1, MoshLetters.letters(typed).count)))
                .font(.poem(15)).lineSpacing(4).multilineTextAlignment(.leading)
            Text(candidate.inDivan ? "\(poet) · توی دیوانت" : poet).font(.ui(11)).foregroundStyle(Color(hex: 0x8A8698))
        }
        .foregroundStyle(Tokens.Colors.ink)
        .padding(.horizontal, 12).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.06), radius: 3, x: 0, y: 2))
    }

    private struct SuggestionKey: Hashable {
        let typed: String
        let letter: Character?
        let used: Int
        let divan: Int
        let books: Int
    }

    private func loadSources() async {
        let model = DivanModel()
        await model.load(marks.keptItems, using: store)
        divan = model.entries
        books = await corpus.corpus(poetry: store, library: library)?.entries ?? []
    }

    private func refreshSuggestions() {
        suggestions = MoshSuggestions.suggestions(
            letter: state.requiredLetter, typed: typed, divan: divan, books: books, used: state.usedKeys, limit: Self.suggestionLimit
        )
    }

    // MARK: Sending

    private func send(_ candidate: MoshCandidate) async {
        guard !sending else { return }
        sending = true
        defer { sending = false }
        if let line = await games.play(candidate, in: state.game.id) { toast = line } else { typed = "" }
    }

    /// The typed text is looked for in the divan and the bundled books; a couplet that isn't found is not sent.
    private func sendTyped() async {
        switch MoshSuggestions.match(typed, letter: state.requiredLetter, divan: divan, books: books, used: state.usedKeys) {
        case .found(let candidate): await send(candidate)
        case .notFound: toast = PlayCopy.notFound
        case .wrongLetter: toast = PlayCopy.wrongLetter(state.requiredLetter)
        case .alreadyPlayed: toast = PlayCopy.alreadyPlayed
        }
    }
}

extension MoshLastLetter {
    /// The first `letters` letters of a hemistich in bold lapis: what the suggestion has in common with what is typed.
    static func prefixMarked(_ text: String, letters count: Int) -> AttributedString {
        var result = AttributedString(text)
        var seen = 0
        var end = text.startIndex
        for index in text.indices where seen < count {
            if text[index].unicodeScalars.contains(where: { MoshLetters.first(of: String($0)) != nil }) { seen += 1 }
            end = text.index(after: index)
        }
        guard seen > 0, let range = Range(text.startIndex..<end, in: result) else { return result }
        result[range].foregroundColor = Tokens.Colors.lapis
        return result
    }
}
