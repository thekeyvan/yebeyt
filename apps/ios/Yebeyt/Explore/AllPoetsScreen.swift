import SwiftUI

/// «شاعرها»: every poet of the library as the same circles as the Explore row.
struct AllPoetsScreen: View {
    @Environment(Library.self) private var library

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ScreenHeader(title: "شاعرها")
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8, alignment: .top), count: 4), spacing: 14) {
                    ForEach(library.poets) { poet in
                        NavigationLink(value: Destination.poet(poet.slug)) { PoetTile(poet: poet) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
    }
}
