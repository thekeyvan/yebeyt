#if DEBUG
import Foundation

/// What `-beytSignedIn` (or `-beytPlayStub 1`) answers for games with friends and challenges, so the screens can be seen
/// without a network: a مشاعره game with Sara where it is my turn (`g1`: the couplets chain on «س» and «د»), a رودررو game
/// (`d1`, played by a script of live events: see `DuelScript`), games made in the lobby (they wait for a friend), and a
/// challenge of ten couplets by Saadi (`7KQ2`, made by نیلوفر with 8 of 10). A move is kept, and Sara answers it a moment later
/// with a live event (always the same couplet: the stub doesn't check letters).
enum PlayStub {
    /// The game ids the screens open in a debug launch.
    static let moshID = "g1"
    static let duelID = "d1"
    static let challengeCode = "7KQ2"

    private final class State: @unchecked Sendable {
        private let lock = NSLock()
        private var played: [String] = []
        private var made: [String: String] = [:]
        private var resigned = false
        private var answered = 0
        private var sink: (@Sendable (String) -> Void)?

        func play(_ move: String) { lock.withLock { played.append(move) } }
        var moves: [String] { lock.withLock { played } }
        func make(_ id: String, kind: String) { lock.withLock { made[id] = kind } }
        func kind(of id: String) -> String? { lock.withLock { made[id] } }
        /// How many of my moves Sara has answered so far.
        var replies: Int { lock.withLock { answered } }
        func replied() { lock.withLock { answered += 1 } }
        func resign() { lock.withLock { resigned = true } }
        var isResigned: Bool { lock.withLock { resigned } }
        func setSink(_ new: (@Sendable (String) -> Void)?) { lock.withLock { sink = new } }
        func send(_ frame: String) { lock.withLock { sink }?(frame) }
    }

    private static let state = State()

    /// The fake socket tells where live frames go (the one socket that is open).
    static func connect(_ sink: @escaping @Sendable (String) -> Void) { state.setSink(sink) }

    // MARK: JSON

    private static func iso(_ seconds: Double) -> String { ServerTime.string(from: Date.now.addingTimeInterval(seconds)) }

    private static let myFace = #"{"face":"sand","eyes":"round","hair":"dark","mouth":"smile","accessory":"none","background":"sun"}"#
    private static let saraFace = #"{"face":"peach","eyes":"round","hair":"dark","mouth":"smile","accessory":"none","background":"rose"}"#

    private static func players(me: Int, sara: Int?) -> String {
        let mine = #"{"username":"niloofar","displayName":null,"avatar":\#(myFace),"seat":0,"score":\#(me)}"#
        guard let sara else { return "[\(mine)]" }
        return #"[\#(mine),{"username":"sara.ghazal","displayName":"سارا","avatar":\#(saraFace),"seat":1,"score":\#(sara)}]"#
    }

    private static func move(_ n: Int, by username: String, key: String, _ m1: String, _ m2: String, ago: Double) -> String {
        #"{"n":\#(n),"username":"\#(username)","key":"\#(key)","m1":"\#(m1)","m2":"\#(m2)","createdAt":"\#(iso(-ago))"}"#
    }

    /// The two couplets played so far in `g1`: mine ends with س, Sara's starts with it and ends with د.
    private static let opening = [
        move(1, by: "niloofar", key: "/hafez/ghazal/sh267#0", "ای صبا گر بُگذری بر ساحلِ رودِ اَرَس", "بوسه زن بر خاکِ آن وادی و مُشکین کُن نَفَس", ago: 7200),
        move(2, by: "sara.ghazal", key: "/hafez/ghazal/sh100#2", "سود و زیان و مایه چو خواهد شدن ز دست", "از بهر این معامله غمگین مباش و شاد", ago: 3600),
    ]

    /// Sara's answer to the next move, whatever it was.
    private static let reply = move(0, by: "sara.ghazal", key: "/hafez/ghazal/sh7#0", "دلا نزد کسی بنشین که او از دل خبر دارد", "به زیر کلک نکته‌ها", ago: 0)

    private static func mosh(id: String, resigned: Bool) -> String {
        let mine = state.moves, replies = state.replies
        var all = opening
        for (index, text) in mine.enumerated() {
            all.append(text.replacingOccurrences(of: #""n":0"#, with: #""n":\#(3 + 2 * index)"#))
            if index < replies { all.append(reply.replacingOccurrences(of: #""n":0"#, with: #""n":\#(4 + 2 * index)"#)) }
        }
        let itsMyTurn = mine.count == replies
        let turn = resigned ? "null" : #"{"username":"\#(itsMyTurn ? "niloofar" : "sara.ghazal")","deadline":"\#(iso(21 * 3600 + 600))"}"#
        let status = resigned ? "done" : "active"
        let winner = resigned ? #""sara.ghazal""# : "null"
        let reason = resigned ? #""resigned""# : "null"
        return """
        {"id":"\(id)","kind":"mosh","turnSeconds":86400,"status":"\(status)","code":"M4R9","createdAt":"\(iso(-86_400))","endedAt":null,"winner":\(winner),\
        "endReason":\(reason),"players":\(players(me: 4 + mine.count, sara: 3 + replies)),"turn":\(turn),"moves":[\(all.joined(separator: ","))]}
        """
    }

    private static func waiting(id: String, kind: String) -> String {
        let seconds = kind == "duel" ? 8 : 86_400
        return """
        {"id":"\(id)","kind":"\(kind)","turnSeconds":\(seconds),"status":"waiting","code":"M4R9","createdAt":"\(iso(0))","endedAt":null,"winner":null,"endReason":null,\
        "players":\(players(me: 0, sara: nil)),"turn":null,"moves":[],"rounds":[]}
        """
    }

    private static let duelGame = """
    {"id":"d1","kind":"duel","turnSeconds":8,"status":"active","code":"D4EL","createdAt":"\("2026-11-24T09:00:00.000Z")","endedAt":null,"winner":null,"endReason":null,\
    "players":\(players(me: 2, sara: 1)),"turn":null,"moves":[],"rounds":[]}
    """

    private static func challenge() -> String {
        let keys = deckKeys(poet: "saadi", count: 10).map { "\"\($0)\"" }.joined(separator: ",")
        return #"{"creator":{"username":"nila","displayName":"نیلوفر","avatar":\#(myFace)},"game":"jigsaw","items":[\#(keys)],"score":8,"seconds":102,"label":"۱۰ بیت سعدی"}"#
    }

    /// The first `count` playable couplets of the deck by a poet, as keys.
    private static func deckKeys(poet: String, count: Int) -> [String] {
        struct Entry: Decodable { var poem: String; var index: Int; var m2: String; var poet: String }
        guard let url = Bundle.main.url(forResource: "games", withExtension: "json"),
              let entries = try? JSONDecoder().decode([Entry].self, from: Data(contentsOf: url)) else { return [] }
        return entries.filter { $0.poet == poet && (3...14).contains($0.m2.split(whereSeparator: \.isWhitespace).count) }.prefix(count).map { "\($0.poem)#\($0.index)" }
    }

    // MARK: Answering

    /// nil for a request that is not about games or challenges.
    static func answer(method: String, path: String, body: Data, hasToken: Bool) -> (Int, String)? {
        let json = (try? JSONSerialization.jsonObject(with: body) as? [String: Any]) ?? [:]
        let parts = path.split(separator: "/").map(String.init)  // v1, games, <id>, moves
        switch (method, path) {
        case ("GET", "/v1/me/games"): return (200, #"{"items":[\#(mosh(id: moshID, resigned: state.isResigned))]}"#)
        case ("POST", "/v1/games"):
            let kind = json["kind"] as? String ?? "mosh"
            let invited = (json["invite"] as? [String]) ?? []
            let id = "new-\(kind)"
            state.make(id, kind: kind)
            let names = invited.map { "\"\($0)\"" }.joined(separator: ",")
            return (201, #"{"game":\#(waiting(id: id, kind: kind)),"invited":[\#(names)],"skipped":[]}"#)
        case ("POST", "/v1/challenges"): return (201, #"{"code":"\#(challengeCode)","url":"https://yebeyt.com/c/\#(challengeCode)"}"#)
        case ("GET", "/v1/me/challenges"): return (200, #"{"items":[]}"#)
        default: break
        }
        if parts.count == 3, parts[1] == "challenges", method == "GET" { return (200, challenge()) }
        if parts.count == 4, parts[1] == "challenges", parts[3] == "results", method == "POST" {
            let name = (json["name"] as? String ?? "").trimmingCharacters(in: .whitespaces)
            return hasToken || !name.isEmpty ? (201, #"{"id":"00000000-0000-0000-0000-0000000000c1"}"#) : (400, #"{"error":"invalid_request"}"#)
        }
        guard parts.count >= 3, parts[1] == "games" else { return nil }
        let id = parts[2]
        switch (method, parts.count) {
        case ("GET", 3):
            if id == duelID { return (200, duelGame) }
            if let kind = state.kind(of: id) { return (200, waiting(id: id, kind: kind)) }
            return id == moshID ? (200, mosh(id: id, resigned: state.isResigned)) : (404, #"{"error":"not_found"}"#)
        case ("POST", 4) where parts[3] == "join":
            return id == duelID ? (200, duelGame) : (200, mosh(id: id, resigned: false))
        case ("POST", 4) where parts[3] == "moves":
            let key = json["key"] as? String ?? "/hafez/ghazal/sh1#0"
            state.play(move(0, by: "niloofar", key: key, json["m1"] as? String ?? "", json["m2"] as? String ?? "", ago: 0))
            scheduleReply(game: id)
            return (200, mosh(id: id, resigned: false))
        case ("POST", 4) where parts[3] == "resign":
            state.resign()
            return (200, mosh(id: id, resigned: true))
        default:
            return nil
        }
    }

    /// Two seconds after a move Sara answers it, as live events: her couplet and the turn coming back.
    private static func scheduleReply(game id: String) {
        let count = state.moves.count
        Task {
            try? await Task.sleep(for: .seconds(2))
            state.replied()
            let number = 2 + 2 * count
            let numbered = reply.replacingOccurrences(of: #""n":0"#, with: #""n":\#(number)"#)
            state.send(#"{"type":"game.move","gameId":"\#(id)","move":\#(numbered),"scores":[{"username":"niloofar","score":\#(4 + count)},{"username":"sara.ghazal","score":\#(3 + count)}]}"#)
            state.send(#"{"type":"game.turn","gameId":"\#(id)","username":"niloofar","deadline":"\#(iso(21 * 3600))"}"#)
        }
    }
}

/// The live side of the debug رودررو (`-beytRoute duel`): rounds one to three are told as done (I won the first and the
/// third), round four is asked with Sara already out of it, and every answer is answered: a right one wins the round,
/// a wrong one locks me out and Sara wins it. After round five the game ends with its five couplets.
final class DuelScript: @unchecked Sendable {
    private struct Question: Sendable {
        let kind: String
        let couplet: String
        let poet: String?
        let options: [String]
        let right: Int
    }

    private static let questions = [
        4: Question(kind: "second", couplet: #"{"m1":"توانا بود هر که دانا بود"}"#, poet: "فردوسی", options: ["ز دانش دل پیر برنا بود", "به دانش دل مرد بینا بود", "ز گفتار او جان شکیبا بود"], right: 0),
        5: Question(kind: "poet", couplet: #"{"m1":"بنی آدم اعضای یکدیگرند","m2":"که در آفرینش ز یک گوهرند"}"#, poet: nil, options: ["مولانا", "حافظ", "سعدی", "فردوسی"], right: 2),
    ]

    private let yield: @Sendable (String) -> Void
    private let lock = NSLock()
    private var scores = (me: 2, sara: 1)

    init(yield: @escaping @Sendable (String) -> Void) {
        self.yield = yield
        Task {
            try? await Task.sleep(for: .seconds(0.6))
            self.begin()
        }
    }

    private func scoresJSON() -> String {
        let (me, sara) = lock.withLock { scores }
        return #"[{"username":"niloofar","score":\#(me)},{"username":"sara.ghazal","score":\#(sara)}]"#
    }

    private func round(_ number: Int, winner: String?, right: Int, mine: Int, saras: Int) {
        lock.withLock { scores = (mine, saras) }
        let won = winner.map { "\"\($0)\"" } ?? "null"
        yield(#"{"type":"duel.round","gameId":"d1","round":\#(number),"winner":\#(won),"rightOption":\#(right),"scores":\#(scoresJSON())}"#)
    }

    private func ask(_ number: Int) {
        guard let question = Self.questions[number] else { return }
        let poet = question.poet.map { "\"\($0)\"" } ?? "null"
        let options = question.options.map { "\"\($0)\"" }.joined(separator: ",")
        yield(#"{"type":"duel.question","gameId":"d1","round":\#(number),"rounds":5,"kind":"\#(question.kind)","couplet":\#(question.couplet),"poet":\#(poet),"options":[\#(options)],"deadlineMs":8000}"#)
    }

    private func begin() {
        round(1, winner: "niloofar", right: 0, mine: 1, saras: 0)
        round(2, winner: "sara.ghazal", right: 1, mine: 1, saras: 1)
        round(3, winner: "niloofar", right: 2, mine: 2, saras: 1)
        ask(4)
        yield(#"{"type":"duel.answered","gameId":"d1","round":4,"username":"sara.ghazal"}"#)
    }

    /// An answer frame from the app: `{"type":"duel.answer","gameId":"d1","round":4,"option":0}`.
    func answer(_ frame: String) {
        guard let object = (try? JSONSerialization.jsonObject(with: Data(frame.utf8))) as? [String: Any],
              object["type"] as? String == "duel.answer", let number = object["round"] as? Int, let option = object["option"] as? Int,
              let question = Self.questions[number] else { return }
        let (me, sara) = lock.withLock { scores }
        Task {
            if option == question.right {
                round(number, winner: "niloofar", right: question.right, mine: me + 1, saras: sara)
            } else {
                yield(#"{"type":"duel.answered","gameId":"d1","round":\#(number),"username":"niloofar"}"#)
                try? await Task.sleep(for: .seconds(0.8))
                round(number, winner: "sara.ghazal", right: question.right, mine: me, saras: sara + 1)
            }
            try? await Task.sleep(for: .seconds(1))
            if number == 4 { ask(5) } else { finish() }
        }
    }

    private func finish() {
        let (me, sara) = lock.withLock { scores }
        let results: [(String, String, String?)] = [
            ("/hafez/ghazal/sh3#0", "ferdousi", "niloofar"), ("/saadi/divan/ghazals/sh2#0", "saadi", "sara.ghazal"), ("/hafez/ghazal/sh8#4", "hafez", "niloofar"),
            ("/ferdousi/shahname/sh1#0", "ferdousi", "niloofar"), ("/saadi/divan/ghazals/sh24#1", "saadi", nil),
        ]
        let rows = results.enumerated().map { index, row in
            let winner = row.2.map { "\"\($0)\"" } ?? "null"
            return #"{"round":\#(index + 1),"type":"second","key":"\#(row.0)","m1":"توانا بود هر که دانا بود","m2":"ز دانش دل پیر برنا بود","meaning":"هر که دانا باشد، توانا هم هست.","poet":"\#(row.1)","bookTitle":"شاهنامه","winner":\#(winner)}"#
        }
        yield(#"{"type":"game.ended","gameId":"d1","winner":"\#(me > sara ? "niloofar" : "sara.ghazal")","reason":"finished","scores":\#(scoresJSON()),"couplets":[\#(rows.joined(separator: ","))]}"#)
    }
}
#endif
