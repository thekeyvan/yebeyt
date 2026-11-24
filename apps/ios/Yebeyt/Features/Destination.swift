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
    // Pushed on the من tab:
    case divan
    case privacy
    case avatar
    case invite
    case settings
    case badges
    case licenses
    // Pushed on the پیام‌ها tab:
    /// A chat, by its conversation id.
    case chat(String)
    /// The divan shared with a person, by their username.
    case sharedDivan(String)
}
