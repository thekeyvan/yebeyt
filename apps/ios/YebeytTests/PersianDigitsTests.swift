import Testing
@testable import Yebeyt

struct PersianDigitsTests {
    @Test func convertsDigits() {
        #expect(PersianDigits.string(2480) == "۲۴۸۰")
        #expect(PersianDigits.string(0) == "۰")
        #expect(PersianDigits.string(7) == "۷")
    }

    @Test func convertsTheDigitsOfAText() {
        #expect(PersianDigits.convert("2.0.0") == "۲.۰.۰")
        #expect(PersianDigits.convert("نسخه 12") == "نسخه ۱۲")
    }

    @Test func groupsThousandsWithThePersianSeparator() {
        #expect(PersianDigits.grouped(2480) == "۲٬۴۸۰")
        #expect(PersianDigits.grouped(999) == "۹۹۹")
        #expect(PersianDigits.grouped(1_234_567) == "۱٬۲۳۴٬۵۶۷")
    }
}
