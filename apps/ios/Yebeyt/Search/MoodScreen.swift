import SwiftUI

/// A mood: couplets of the bundled books that contain the mood's words, the most recited first.
struct MoodScreen: View {
    @Environment(PoetryStore.self) private var poetry
    @Environment(Library.self) private var library
    @Environment(CorpusStore.self) private var corpusStore
    let mood: Mood
    @State private var entries: [CoupletEntry]?

    private static let limit = 60

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                if let entries {
                    if entries.isEmpty { NothingFound() }
                    ForEach(entries) { CoupletRow(entry: $0) }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader { ScreenHeader(title: mood.title) }
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task {
            entries = await corpusStore.corpus(poetry: poetry, library: library)?.matching(mood, limit: Self.limit)
        }
    }
}
