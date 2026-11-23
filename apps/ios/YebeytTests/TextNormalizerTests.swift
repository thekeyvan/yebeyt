import Foundation
import Testing
@testable import Yebeyt

struct TextNormalizerTests {
    @Test func removesDiacriticsAndTatweel() {
        #expect(TextNormalizer.normalize("اَلا یا اَیُّهَا السّاقی") == "الا یا ایها الساقی")
        #expect(TextNormalizer.normalize("عـشـق") == "عشق")
    }

    @Test func unifiesArabicLettersWithPersianOnes() {
        #expect(TextNormalizer.normalize("كتاب") == "کتاب")
        #expect(TextNormalizer.normalize("علي") == "علی")
        #expect(TextNormalizer.normalize("موسى") == "موسی")
    }

    @Test func zwnjBecomesASpace() {
        #expect(TextNormalizer.normalize("می\u{200C}رود") == "می رود")
        #expect(TextNormalizer.normalize("می\u{200C}\u{200C} رود") == "می رود")
    }

    @Test func alefWithMaddaBecomesAlef() {
        #expect(TextNormalizer.normalize("آرام") == "ارام")
        #expect(TextNormalizer.normalize("کآرام") == "کارام")
    }

    @Test func digitsBecomeLatinAndPunctuationBecomesSpace() {
        #expect(TextNormalizer.normalize("غزل ۱۲ و ٣") == "غزل 12 و 3")
        #expect(TextNormalizer.normalize("کجایی؟ «من»، تو!") == "کجایی من تو")
    }

    @Test func collapsesSpacesAndLowercases() {
        #expect(TextNormalizer.normalize("  Hafez \n  Shirazi ") == "hafez shirazi")
        #expect(TextNormalizer.normalize("") == "")
    }

    @Test func containsMatchesAcrossSpellings() {
        #expect(TextNormalizer.contains("ای ساربان آهسته رو کآرام جانم می‌رود", query: "ارام جانم"))
        #expect(TextNormalizer.contains("می‌رود", query: "می رود"))
        #expect(TextNormalizer.contains("عشق", query: "عشق"))
        #expect(!TextNormalizer.contains("عشق", query: "عاشق"))
    }

    @Test func plainOnlyRemovesTheMarks() {
        #expect(TextNormalizer.plain("اَلا یا اَیُّهَا السّاقی اَدِرْ کَأسَاً") == "الا یا ایها الساقی ادر کأسا")
        #expect(TextNormalizer.plain("می\u{200C}رود، آي") == "می\u{200C}رود، آي")
    }

    @Test func anEmptyQueryMatchesNothing() {
        #expect(!TextNormalizer.contains("عشق", query: ""))
        #expect(!TextNormalizer.contains("عشق", query: " ؟ "))
    }
}
