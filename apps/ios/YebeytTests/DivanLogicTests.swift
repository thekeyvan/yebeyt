import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct DivanLogicTests {
    private func entry(_ path: String, _ index: Int, _ m1: String, _ m2: String, keptAt: Int64, title: String = "غزل ۱") -> DivanEntry {
        DivanEntry(
            key: "\(path)#\(index)", path: path, index: index, couplet: Couplet(m1: m1, m2: m2),
            poetSlug: String(path.split(separator: "/")[0]), title: title, keptAt: keptAt
        )
    }

    private let names = ["hafez": "حافظ", "saadi": "سعدی", "moulavi": "مولانا"]
    private var poetName: (String) -> String { { names[$0] ?? $0 } }
    private let moods = [
        Mood(key: "love", title: "عشق", words: ["عشق", "عاشق"]),
        Mood(key: "spring", title: "بهار", words: ["بهار", "گل"]),
    ]

    private var sample: [DivanEntry] {
        [
            entry("hafez/g/sh1", 0, "الا یا ایها الساقی ادر کأسا و ناولها", "که عشق آسان نمود اول ولی افتاد مشکل‌ها", keptAt: 300),
            entry("hafez/g/sh3", 1, "بده ساقی می باقی که در جنت نخواهی یافت", "کنار آب رکن آباد و گلگشت مصلا را", keptAt: 500),
            entry("saadi/g/sh207", 0, "ای ساربان آهسته رو کآرام جانم می‌رود", "وان دل که با خود داشتم با دلستانم می‌رود", keptAt: 100),
            entry("moulavi/m/sh1", 0, "بشنو این نی چون شکایت می‌کند", "از جدایی‌ها حکایت می‌کند", keptAt: 400),
        ]
    }

    // MARK: Search

    @Test func searchMatchesWordsOfTheCoupletAfterNormalising() {
        let entries = sample
        #expect(DivanLogic.filter(entries, query: "ساقی", poet: nil, poetName: poetName).count == 2)
        // Arabic ی/ک and a missing half-space still match; diacritics and digits don't get in the way.
        #expect(DivanLogic.filter(entries, query: "جدايى", poet: nil, poetName: poetName).map(\.key) == ["moulavi/m/sh1#0"])
        #expect(DivanLogic.filter(entries, query: "  آرام ", poet: nil, poetName: poetName).map(\.key) == ["saadi/g/sh207#0"])
    }

    @Test func searchAlsoMatchesThePoetsName() {
        let found = DivanLogic.filter(sample, query: "سعدی", poet: nil, poetName: poetName)
        #expect(found.map(\.key) == ["saadi/g/sh207#0"])
    }

    @Test func anEmptyQueryKeepsEverythingAndTheNewestComeFirst() {
        let all = DivanLogic.filter(sample, query: "  ", poet: nil, poetName: poetName)
        #expect(all.map(\.keptAt) == [500, 400, 300, 100])
    }

    @Test func aPoetFilterKeepsOnlyThatPoet() {
        #expect(DivanLogic.filter(sample, query: "", poet: "hafez", poetName: poetName).count == 2)
        #expect(DivanLogic.filter(sample, query: "عشق", poet: "saadi", poetName: poetName).isEmpty)
    }

    // MARK: Grouping

    @Test func poetChipsCountEachPoetMostFirst() {
        let chips = DivanLogic.poetCounts(sample)
        #expect(chips.map(\.slug) == ["hafez", "moulavi", "saadi"])
        #expect(chips.map(\.count) == [2, 1, 1])
    }

    @Test func groupingByPoetPutsTheBiggestPoetFirstAndEachSectionNewestFirst() {
        let sections = DivanLogic.sections(sample, grouping: .poet, moods: moods, poetName: poetName)
        #expect(sections.map(\.title) == ["حافظ", "مولانا", "سعدی"])  // equal counts: by slug
        #expect(sections[0].poetSlug == "hafez")
        #expect(sections[0].entries.map(\.keptAt) == [500, 300])
        #expect(sections.map(\.entries.count) == [2, 1, 1])
    }

    @Test func groupingByTopicUsesTheFirstMoodThatMatchesElseTheRest() {
        let sections = DivanLogic.sections(sample, grouping: .topic, moods: moods, poetName: poetName)
        // «الا یا ایها…» has «عشق»; «بده ساقی…» has «گل» (in «گلگشت»); the others match nothing.
        #expect(sections.map(\.title) == ["عشق", "بهار", "بقیه"])
        #expect(sections[0].entries.map(\.key) == ["hafez/g/sh1#0"])
        #expect(sections[1].entries.map(\.key) == ["hafez/g/sh3#1"])
        #expect(sections[2].entries.map(\.key) == ["moulavi/m/sh1#0", "saadi/g/sh207#0"])
    }

    @Test func aCoupletThatMatchesTwoMoodsGoesToTheFirstOnly() {
        let both = entry("a/b/c", 0, "عشق بهار", "", keptAt: 1)
        let sections = DivanLogic.sections([both], grouping: .topic, moods: moods, poetName: poetName)
        #expect(sections.map(\.title) == ["عشق"])
    }

    @Test func newestIsOneListWithoutHeaders() {
        let sections = DivanLogic.sections(sample, grouping: .newest, moods: moods, poetName: poetName)
        #expect(sections.count == 1)
        #expect(sections[0].title.isEmpty)
        #expect(sections[0].entries.map(\.keptAt) == [500, 400, 300, 100])
    }

    @Test func emptySectionsAreLeftOut() {
        #expect(DivanLogic.sections([], grouping: .topic, moods: moods, poetName: poetName).isEmpty)
        #expect(DivanLogic.sections([], grouping: .newest, moods: moods, poetName: poetName).isEmpty)
    }

    // MARK: Relative day

    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Tehran")!
        return calendar
    }()

    private func line(daysAgo: Int, hour: Int = 9) -> String {
        let now = calendar.date(from: DateComponents(year: 2026, month: 11, day: 23, hour: 15))!
        let day = calendar.date(byAdding: .day, value: -daysAgo, to: calendar.date(bySettingHour: hour, minute: 0, second: 0, of: now)!)!
        return DivanDays.relative(keptAt: DivanTime.milliseconds(of: day), now: now, calendar: calendar)
    }

    @Test func todayYesterdayLastWeekThenTheDate() {
        #expect(line(daysAgo: 0, hour: 1) == "امروز")
        #expect(line(daysAgo: 1, hour: 23) == "دیروز")
        #expect(line(daysAgo: 2) == "هفته‌ی پیش")
        #expect(line(daysAgo: 7) == "هفته‌ی پیش")
        #expect(line(daysAgo: 8) == "۲۴ آبان")  // 2026-11-15
    }
}

@MainActor
struct DivanModelTests {
    @Test func keptCoupletsBecomeEntriesWithTheirTextPoetAndTitle() async throws {
        let store = try PoetryStore(bundle: Fixtures.appBundle)
        let model = DivanModel()
        let items = [DivanItem(key: "/hafez/ghazal/sh3#0", keptAt: 5_000, removedAt: nil), DivanItem(key: "/hafez/ghazal/sh3#1", keptAt: 9_000, removedAt: nil)]
        await model.load(items, using: store)
        #expect(model.entries.map(\.key) == ["/hafez/ghazal/sh3#1", "/hafez/ghazal/sh3#0"])
        let first = try #require(model.entries.last)
        #expect(first.poetSlug == "hafez")
        #expect(first.title == "غزل ۳")
        #expect(!first.couplet.m1.isEmpty && !first.couplet.m2.isEmpty)
        #expect(first.keptAt == 5_000)
    }

    @Test func aCoupletThatCannotBeLoadedIsLeftOut() async throws {
        let store = try PoetryStore(bundle: Fixtures.appBundle, session: StubURLProtocol.session(), cacheDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString))
        StubURLProtocol.reset()
        let model = DivanModel()
        await model.load([DivanItem(key: "/hafez/ghazal/sh3#0", keptAt: 1, removedAt: nil), DivanItem(key: "/nobody/book/sh9#0", keptAt: 2, removedAt: nil), DivanItem(key: "/hafez/ghazal/sh3#99", keptAt: 3, removedAt: nil)], using: store)
        #expect(model.entries.map(\.key) == ["/hafez/ghazal/sh3#0"])
    }
}
