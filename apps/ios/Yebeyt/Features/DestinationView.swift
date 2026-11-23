import SwiftUI

/// The screen a `Destination` stands for. A destination whose book, section or poet is unknown shows nothing.
struct DestinationView: View {
    @Environment(Library.self) private var library
    let destination: Destination

    var body: some View {
        switch destination {
        case .library:
            LibraryScreen()
        case .book(let id):
            if let book = library.book(id: id) { BookScreen(book: book) }
        case .section(let bookId, let sectionId):
            if let book = library.book(id: bookId), let section = book.section(id: sectionId) {
                SectionScreen(book: book, section: section)
            }
        case .poet(let slug):
            if let poet = library.poet(slug: slug) { PoetScreen(poet: poet) }
        case .search(let query):
            SearchScreen(initial: query)
        case .mood(let key):
            if let mood = library.moods.first(where: { $0.key == key }) { MoodScreen(mood: mood) }
        case .allPoets:
            AllPoetsScreen()
        }
    }
}
