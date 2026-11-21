import Foundation

/// Hand-picked content. In a later version moods come from semantic search over couplet meanings.
enum Content {
    static let moods: [Mood] = [
        Mood(key: "sad", title: "غم مخور", detail: "وقتی دلت گرفته", scene: .moon, hue: 225,
             items: refs(("hafez/ghazal/sh255", 0), ("hafez/ghazal/sh255", 1), ("hafez/ghazal/sh255", 3), ("babataher/2beytiha/sh1", 0), ("hafez/ghazal/sh255", 4))),
        Mood(key: "friend", title: "چشم یاری", detail: "وقتی از رفیقت دلخوری", scene: .cups, hue: 30,
             items: refs(("hafez/ghazal/sh369", 0), ("hafez/ghazal/sh369", 1), ("hafez/ghazal/sh369", 2), ("hafez/ghazal/sh369", 3))),
        Mood(key: "love", title: "عشق", detail: "وقتی دلت جای دیگه‌ست", scene: .candle, hue: 350,
             items: refs(("moulavi/shams/ghazalsh/sh1393", 0), ("hafez/ghazal/sh152", 0), ("moulavi/shams/ghazalsh/sh1393", 2), ("hafez/ghazal/sh1", 0), ("hafez/ghazal/sh152", 1))),
        Mood(key: "miss", title: "جدایی", detail: "وقتی دلتنگ کسی هستی", scene: .ney, hue: 265,
             items: refs(("moulavi/masnavi/daftar1/sh1", 0), ("moulavi/masnavi/daftar1/sh1", 3), ("moulavi/masnavi/daftar1/sh1", 2), ("hafez/ghazal/sh1", 4))),
        Mood(key: "now", title: "دم را دریاب", detail: "وقتی یادت می‌ره زندگی کوتاهه", scene: .jug, hue: 195,
             items: refs(("khayyam/robaee/sh1", 1), ("khayyam/robaee/sh1", 0), ("hafez/ghazal/sh255", 2))),
        Mood(key: "world", title: "بنی آدم", detail: "وقتی دنیا بی‌انصاف به نظر میاد", scene: .ring, hue: 160,
             items: refs(("saadi/golestan/gbab1/sh10", 0), ("saadi/golestan/gbab1/sh10", 1), ("saadi/golestan/gbab1/sh10", 2), ("hafez/ghazal/sh152", 4))),
        Mood(key: "hope", title: "امید", detail: "وقتی یه کم نور لازمی", scene: .sun, hue: 45,
             items: refs(("hafez/ghazal/sh255", 5), ("hafez/ghazal/sh255", 2), ("moulavi/shams/ghazalsh/sh1393", 3), ("ferdousi/shahname/aghaz/sh1", 0))),
    ]

    static let today = CoupletRef("hafez/ghazal/sh255", 0)
    static let homeDeck: [CoupletRef] = [today] + refs(("hafez/ghazal/sh369", 0), ("khayyam/robaee/sh1", 1), ("moulavi/masnavi/daftar1/sh1", 0),
                                                       ("saadi/golestan/gbab1/sh10", 0), ("moulavi/shams/ghazalsh/sh1393", 0), ("ferdousi/shahname/aghaz/sh1", 0), ("hafez/ghazal/sh152", 0))

    static let starters: [(url: String, label: String)] = [
        ("hafez/ghazal", "دیوان حافظ"), ("khayyam/robaee", "رباعیات خیام"), ("babataher/2beytiha", "دوبیتی‌های باباطاهر"),
        ("moulavi/masnavi", "مثنوی معنوی"), ("ferdousi/shahname", "شاهنامه"), ("saadi/golestan", "گلستان"),
    ]

    static let sceneOf: [String: ArtScene] = [
        "hafez/ghazal/sh1": .cup, "hafez/ghazal/sh255": .moon, "khayyam/robaee/sh1": .jug, "saadi/golestan/gbab1/sh10": .ring,
        "moulavi/masnavi/daftar1/sh1": .ney, "moulavi/shams/ghazalsh/sh1393": .sun, "ferdousi/shahname/aghaz/sh1": .feather,
        "hafez/ghazal/sh152": .candle, "hafez/ghazal/sh369": .cups, "babataher/2beytiha/sh1": .mountain,
    ]
    static let poetScene: [String: ArtScene] = ["hafez": .cup, "khayyam": .jug, "moulavi": .ney, "saadi": .rose, "ferdousi": .feather, "babataher": .mountain]

    static func mood(of r: CoupletRef) -> Mood? { moods.first { $0.items.contains(r) } }

    static func scene(for url: String, index: Int? = nil) -> ArtScene {
        if let i = index, let m = mood(of: CoupletRef(url, i)) { return m.scene }
        if let s = sceneOf[url] { return s }
        if let s = poetScene[String(url.split(separator: "/").first ?? "")] { return s }
        let fallback: [ArtScene] = [.moon, .candle, .rose, .sun, .jug]
        return fallback[Int(hashHue(url)) % fallback.count]
    }

    private static func refs(_ items: (String, Int)...) -> [CoupletRef] { items.map { CoupletRef($0.0, $0.1) } }
}
