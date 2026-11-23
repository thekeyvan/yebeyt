import Foundation

/// library.json, written by `tools/ganjoor/build.py` from curation.json and Ganjoor's categories.
struct LibraryFile: Decodable, Sendable {
    var poets: [LibraryPoet]
    var books: [LibraryBook]
    var moods: [Mood]
    /// The poet slugs of the Explore row, in order.
    var explorePoets: [String]
}

struct LibraryPoet: Decodable, Hashable, Sendable, Identifiable {
    var id: Int
    var slug: String
    /// The short display name.
    var name: String
    /// «شاعرِ غزل», the tilted sticker on the poet's card.
    var tag: String
    var city: String?
    var century: String?
    var color: PaletteColor
    var bio: String

    /// The default picture's letter.
    var initial: String { PoetPicture.letter(for: name) }

    /// «شیراز · قرن هشتم»; whichever part is known.
    var place: String? {
        let parts = [city, century].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

enum PoetPicture {
    /// The first letter of the name, for the default picture (a circle in the poet's colour).
    static func letter(for name: String) -> String {
        name.first.map(String.init) ?? ""
    }
}

struct Mood: Decodable, Hashable, Sendable, Identifiable {
    var key: String
    var title: String
    var words: [String]
    var id: String { key }
}

/// The type chips of the Library.
enum BookType: String, Decodable, CaseIterable, Sendable {
    case divan, masnavi, robai, prose, modern

    var chipTitle: String {
        switch self {
        case .divan: "دیوان‌ها"
        case .masnavi: "مثنوی و داستان"
        case .robai: "رباعی"
        case .prose: "نثر و حکایت"
        case .modern: "معاصر"
        }
    }
}

/// A category inside a book (غزلیات, or a part of the Shahnameh), with every poem below it counted.
struct BookSection: Decodable, Hashable, Sendable, Identifiable {
    var id: Int
    var title: String
    /// Ganjoor's path, e.g. `/hafez/ghazal`.
    var path: String
    var count: Int
    /// What one poem of it is called: غزل, رباعی, … (شعر when unknown).
    var unit: String
    var sections: [BookSection]?

    var children: [BookSection] { sections ?? [] }

    /// This section's id and every id below it: the categories whose poems belong to it.
    var subtreeIds: Set<Int> {
        children.reduce(into: [id]) { $0.formUnion($1.subtreeIds) }
    }

    func find(id target: Int) -> BookSection? {
        if id == target { return self }
        return children.lazy.compactMap { $0.find(id: target) }.first
    }

    func find(path target: String) -> BookSection? {
        if path == target { return self }
        return children.lazy.compactMap { $0.find(path: target) }.first
    }
}

struct LibraryBook: Decodable, Hashable, Sendable, Identifiable {
    /// Ganjoor's category id. The poem index file is `index-<id>.json`.
    var id: Int
    var path: String
    /// The everyday title.
    var title: String
    /// The poet's slug.
    var poet: String
    var type: BookType
    var color: PaletteColor
    var blurb: String
    var century: String?
    /// Every poem in the book, sections included.
    var count: Int
    /// True when Ganjoor has at least one recitation of it.
    var recited: Bool
    /// The unit of the main section: «یه غزل تصادفی».
    var unit: String
    var sections: [BookSection]?
    /// Poems that sit directly in the book beside its sections.
    var poems: [PoemRef]?

    /// The book as one section, for a book without child categories.
    var asSection: BookSection {
        BookSection(id: id, title: title, path: path, count: count, unit: unit, sections: sections)
    }

    /// The rows of the Book screen: its sections, or the book itself when it has none.
    var rows: [BookSection] {
        sections.flatMap { $0.isEmpty ? nil : $0 } ?? [asSection]
    }

    /// The biggest section: «پرخواننده‌ترین غزل‌ها» of a divan come from it.
    var mainSection: BookSection {
        rows.max { $0.count < $1.count } ?? asSection
    }

    func section(id target: Int) -> BookSection? { asSection.find(id: target) }
    func section(path target: String) -> BookSection? { asSection.find(path: target) }

    /// «قرن هشتم · ۶۹۵ شعر · با خوانش»; the parts that are not known are left out.
    var meta: String {
        [century, "\(PersianDigits.string(count)) شعر", recited ? "با خوانش" : nil].compactMap { $0 }.joined(separator: " · ")
    }
}
