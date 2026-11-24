import Foundation
import Testing
@testable import Yebeyt

/// The same table as the server's `test/persian.test.ts`: the phone and the server must agree on the letters.
struct MoshLettersTests {
    struct Row: Sendable, CustomTestStringConvertible {
        let name: String
        let text: String
        let letter: Character

        init(_ name: String, _ text: String, _ letter: Character) {
            self.name = name
            self.text = text
            self.letter = letter
        }

        var testDescription: String { name }
    }

    static let ends: [Row] = [
        Row("plain", "به خال هندویش بخشم سمرقند و بخارا را", "ا"),
        Row("diacritics are skipped", "کنارِ آبِ رُکناباد و گُل‌گَشتِ مُصَلّا را", "ا"),
        Row("a final mark after the letter", "چو بر آتش نشیند آبَ", "ب"),
        Row("آ is ا", "ز عشقت آ", "ا"),
        Row("Arabic ي is ی", "ماي", "ی"),
        Row("Arabic ى is ی", "موسى", "ی"),
        Row("Arabic ك is ک", "ملك", "ک"),
        Row("ۀ is ه", "خانۀ", "ه"),
        Row("ۀ decomposed (ه and a hamza mark) is ه", "خانه\u{0654}", "ه"),
        Row("ة is ه", "رحمة", "ه"),
        Row("ئ is ی", "جزئ", "ی"),
        Row("trailing punctuation is skipped", "گفتم که ماه من شو، گفتا اگر برآید؟", "د"),
        Row("a trailing half-space and spaces are skipped", "دل مرا\u{200C} ", "ا"),
        Row("a quote and a dash after the line", "رفت «و رفت»…-", "ت"),
        Row("a tatweel is skipped", "دلـــ", "ل"),
        Row("digits are skipped", "بیت ۱۲", "ت"),
    ]

    @Test(arguments: ends) func lastLetter(_ row: Row) {
        #expect(MoshLetters.last(of: row.text) == row.letter)
    }

    static let starts: [Row] = [
        Row("plain", "اگر آن ترک شیرازی", "ا"),
        Row("آ is ا", "آمد بهار", "ا"),
        Row("a leading mark and quote", "«دلم» گفت", "د"),
        Row("Arabic ي is ی", "يا رب", "ی"),
        Row("ئ is ی", "ئاگاه", "ی"),
        Row("Arabic ك is ک", "كه", "ک"),
        Row("diacritics before the first letter", "ـَبرگ", "ب"),
    ]

    @Test(arguments: starts) func firstLetter(_ row: Row) {
        #expect(MoshLetters.first(of: row.text) == row.letter)
    }

    @Test func aTextWithNoLetterHasNone() {
        #expect(MoshLetters.first(of: "۱۲ ، !") == nil)
        #expect(MoshLetters.last(of: "") == nil)
    }

    @Test func anAlefEndingMatchesAnAlefWithMaddaStart() {
        #expect(MoshLetters.last(of: "بیا") == MoshLetters.first(of: "آمد"))
    }

    // The server's `normalizeText` table.
    @Test func twoSpellingsOfAHemistichNormaliseAlike() {
        #expect(TextNormalizer.normalize("اگر آن تُرکِ شیرازی، به‌‌ دست‌ آرَد؟") == TextNormalizer.normalize("اگر ان ترک شیرازي به دست ارد"))
    }

    @Test func arabicFormsAndDigitsFold() {
        #expect(TextNormalizer.normalize("  ملك   ١٢ ۱۲ ") == "ملک 12 12")
        #expect(TextNormalizer.normalize("خانۀ جزئی ٱلله") == "خانه جزیی الله")
    }

    @Test func differentWordsStayDifferent() {
        #expect(TextNormalizer.normalize("دل") != TextNormalizer.normalize("دلا"))
    }
}
