import Foundation

/// A screen pushed on a tab's navigation stack.
enum Destination: Hashable, Sendable {
    case library
    /// A library book, by its category id.
    case book(Int)
    case section(book: Int, section: Int)
    /// A poet, by slug.
    case poet(String)
    /// The search screen, with the text it starts with.
    case search(String)
    /// A mood's couplets, by key.
    case mood(String)
    case allPoets
    /// «همه‌ی بازی‌ها», pushed on the بازی tab.
    case gamesCatalog
}
