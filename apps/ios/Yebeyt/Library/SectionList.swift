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
    /// The Persian alphabet in dictionary order, for sorting by the last letter of the rhyme.
    private static let alphabet = Array("ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی")

    static func sorted(_ poems: [IndexedPoem], by sort: SectionSort) -> [IndexedPoem] {
        switch sort {
        case .number:
            return poems.sorted { $0.number < $1.number }
        case .popularity:
            return poems.sorted { ($0.recitations, $1.number) > ($1.recitations, $0.number) }
        case .lastLetter:
            return poems.sorted { lhs, rhs in
                let (left, right) = (letterKey(lhs.rhyme), letterKey(rhs.rhyme))
                return left == right ? lhs.number < rhs.number : left.lexicographicallyPrecedes(right)
            }
        }
    }

    /// The rhyme's letters from the last backwards, as alphabet places; a poem without a rhyme goes last.
    static func letterKey(_ rhyme: String) -> [Int] {
        let letters = TextNormalizer.normalize(rhyme).filter { $0 != " " }
        return letters.reversed().map { alphabet.firstIndex(of: $0) ?? alphabet.count } + [alphabet.count + 1]
    }

    /// The poems whose first line contains the query, or whose number it is.
    static func filtered(_ poems: [IndexedPoem], query: String) -> [IndexedPoem] {
        let wanted = TextNormalizer.normalize(query)
        guard !wanted.isEmpty else { return poems }
        let number = Int(wanted)
        return poems.filter { $0.number == number || TextNormalizer.normalize($0.first).contains(wanted) }
    }
}
