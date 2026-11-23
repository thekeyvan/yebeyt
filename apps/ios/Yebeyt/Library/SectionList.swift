import Foundation

enum SectionSort: CaseIterable, Sendable {
    case number, lastLetter, popularity

    var title: String {
        switch self {
        case .number: "شماره"
        case .lastLetter: "حرف آخر"
        case .popularity: "پرخواننده"
        }
    }
}

/// The poems of a section as the section screen lists them: searched and sorted.
enum SectionList {
    /// The Persian alphabet in dictionary order, for sorting by the last letter of the rhyme: the hamza
    /// follows alef, and waw with hamza follows waw.
    private static let alphabet = Array("اءبپتثجچحخدذرزژسشصضطظعغفقکگلمنوؤهی")

    static func sorted(_ poems: [IndexedPoem], by sort: SectionSort) -> [IndexedPoem] {
        switch sort {
        case .number:
            return poems.sorted { $0.number < $1.number }
        case .popularity:
            return poems.sorted { ($0.recitations, $1.number) > ($1.recitations, $0.number) }
        case .lastLetter:
            return poems.sorted { lhs, rhs in
                lhs.rhymeKey == rhs.rhymeKey ? lhs.number < rhs.number : lhs.rhymeKey.lexicographicallyPrecedes(rhs.rhymeKey)
            }
        }
    }

    /// The rhyme's letters from the last backwards as alphabet places, then an end marker (-1) that sorts
    /// before every letter, so «ا» comes before «ارا». A poem without a rhyme goes last; letters outside the
    /// alphabet go after all letters.
    static func rhymeKey(_ rhyme: String) -> [Int] {
        let letters = TextNormalizer.normalize(rhyme).filter { $0 != " " }
        guard !letters.isEmpty else { return [Int.max] }
        return letters.reversed().map { letter in
            alphabet.firstIndex(of: letter == "ئ" ? "ی" : letter) ?? alphabet.count
        } + [-1]
    }

    /// The poems whose first line contains the query, or whose number it is.
    static func filtered(_ poems: [IndexedPoem], query: String) -> [IndexedPoem] {
        let wanted = TextNormalizer.normalize(query)
        guard !wanted.isEmpty else { return poems }
        let number = Int(wanted)
        return poems.filter { $0.number == number || $0.searchText.contains(wanted) }
    }
}
