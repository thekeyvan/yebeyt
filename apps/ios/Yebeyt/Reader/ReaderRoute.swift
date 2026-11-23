import Foundation

/// How the reader shows the poem: one couplet at a time, or all of it.
enum ReaderMode: String, Sendable {
    case couplet, scroll
}

/// Where the reader opens: a poem by Ganjoor path, and the state it starts in. The debug launch
/// arguments fill in all of it; later screens (library, search) only need the path and a couplet.
struct ReaderRoute: Equatable, Identifiable, Sendable {
    var path: String
    var couplet = 0
    var mode: ReaderMode = .couplet
    var textSheet = false
    var meaning = false
    var hold: Int?

    var id: String { path }
}
