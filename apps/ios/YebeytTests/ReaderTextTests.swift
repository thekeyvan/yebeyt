import Testing
@testable import Yebeyt

struct ReaderTextTests {
    private let couplet = Couplet(m1: "بده ساقی می باقی", m2: "کنار آب رکن آباد")

    @Test func shortTitleDropsTheWordShomareh() {
        #expect(ReaderText.shortTitle("غزل شمارهٔ ۳") == "غزل ۳")
        #expect(ReaderText.shortTitle("رباعی شمارهٔ ۱۲") == "رباعی ۱۲")
        #expect(ReaderText.shortTitle("بخش ۲ - در ستایش") == "بخش ۲ - در ستایش")
    }

    @Test func subtitleIsPoetAndBook() {
        #expect(ReaderText.subtitle(poet: "حافظ", book: "غزلیات") == "حافظ · غزلیات")
        #expect(ReaderText.subtitle(poet: "حافظ", book: nil) == "حافظ")
    }

    @Test func progressIsWrittenWithAz() {
        #expect(ReaderText.progress(index: 1, count: 9) == "۲ از ۹")
        #expect(ReaderText.progress(index: 0, count: 12) == "۱ از ۱۲")
        #expect(ReaderText.progress(index: 1, count: 9).contains("/") == false)
        #expect(ReaderText.progressLabel(index: 1, count: 9) == "بیت ۲ از ۹")
    }

    @Test func shareTextEndsWithTheSiteAddress() {
        #expect(ReaderText.shareText(couplet, poet: "حافظ", title: "غزل ۳")
            == "بده ساقی می باقی\nکنار آب رکن آباد\n— حافظ · غزل ۳\nyebeyt.com")
    }

    @Test func copyTextEndsWithThePoet() {
        #expect(ReaderText.copyText(couplet, poet: "حافظ") == "بده ساقی می باقی\nکنار آب رکن آباد\n— حافظ")
    }

    @Test func aSingleLineCoupletHasNoEmptyLine() {
        let single = Couplet(m1: "یک خط", m2: "")
        #expect(ReaderText.copyText(single, poet: "نیما") == "یک خط\n— نیما")
        #expect(ReaderText.shareText(single, poet: "نیما", title: "شعر") == "یک خط\n— نیما · شعر\nyebeyt.com")
    }

    @Test func captionNumbersTheCoupletFromOne() {
        #expect(ReaderText.caption(poet: "حافظ", title: "غزل ۳", index: 1) == "حافظ · غزل ۳ · بیت ۲")
    }
}
