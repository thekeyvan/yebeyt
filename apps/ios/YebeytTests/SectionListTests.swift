import Testing
@testable import Yebeyt

struct SectionListTests {
    private func poem(_ number: Int, first: String = "", rhyme: String = "", recitations: Int = 0) -> IndexedPoem {
        IndexedPoem(id: number, catId: 1, path: "/a/b/sh\(number)", first: first, couplets: 7, rhyme: rhyme, recitations: recitations, number: number)
    }

    @Test func numberKeepsTheBooksOrderEvenFromAnotherOrder() {
        let poems = [poem(3), poem(1), poem(2)]
        #expect(SectionList.sorted(poems, by: .number).map(\.number) == [1, 2, 3])
    }

    @Test func lastLetterSortsByTheAlphabetOfTheRhymesLastLetter() {
        // by the last letter ا (then the letters before it: ب…, ر…, ه…), then ب, ل, ن
        let poems = [
            poem(1, rhyme: "لها"), poem(2, rhyme: "ابکجا"), poem(3, rhyme: "ین"), poem(4, rhyme: "ارا"),
            poem(5, rhyme: "ب"), poem(6, rhyme: "ل"), poem(7, rhyme: "ارا"),
        ]
        let order = SectionList.sorted(poems, by: .lastLetter).map(\.number)
        #expect(order == [2, 4, 7, 1, 5, 6, 3])
    }

    @Test func lastLetterNormalisesArabicLettersAndPutsMissingRhymesLast() {
        let poems = [poem(1, rhyme: ""), poem(2, rhyme: "ي"), poem(3, rhyme: "ك"), poem(4, rhyme: "ی")]
        // ک (from ك) before ی (from ي and ی), the poem without a rhyme last
        #expect(SectionList.sorted(poems, by: .lastLetter).map(\.number) == [3, 2, 4, 1])
    }

    @Test func popularitySortsByRecitationsThenNumber() {
        let poems = [poem(1, recitations: 2), poem(2, recitations: 9), poem(3, recitations: 2), poem(4, recitations: 0)]
        #expect(SectionList.sorted(poems, by: .popularity).map(\.number) == [2, 1, 3, 4])
    }

    @Test func filterFindsAWordOfTheFirstLineIgnoringDiacriticsAndSpelling() {
        let poems = [poem(1, first: "اَلا یا اَیُّهَا السّاقی"), poem(2, first: "صلاحِ کار کجا و منِ خراب کجا؟"), poem(3, first: "كجا")]
        #expect(SectionList.filtered(poems, query: "الا").map(\.number) == [1])
        #expect(SectionList.filtered(poems, query: "کجا").map(\.number) == [2, 3])
    }

    @Test func filterFindsANumberInPersianOrLatinDigits() {
        let poems = [poem(1), poem(12), poem(2)]
        #expect(SectionList.filtered(poems, query: "۱۲").map(\.number) == [12])
        #expect(SectionList.filtered(poems, query: "2").map(\.number) == [2])
    }

    @Test func anEmptyQueryKeepsEverything() {
        #expect(SectionList.filtered([poem(1), poem(2)], query: "  ").count == 2)
    }

    @Test func sortModesHaveTheBoardsTitles() {
        #expect(SectionSort.allCases.map(\.title) == ["شماره", "حرف آخر", "پرخواننده"])
    }
}
