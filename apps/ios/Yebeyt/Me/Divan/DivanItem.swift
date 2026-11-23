import Foundation

/// One couplet of the divan as the phone and the server both know it: when it was kept and when it was taken
/// out, in milliseconds since 1970. It is kept when `keptAt` is after `removedAt`; a removed couplet stays as a
/// record (its `removedAt`), so a removal made on one phone reaches the others. The key is `ReaderMarks.key`.
struct DivanItem: Equatable, Sendable, Codable {
    var key: String
    var keptAt: Int64?
    var removedAt: Int64?

    var isKept: Bool {
        guard let keptAt else { return false }
        return removedAt.map { keptAt > $0 } ?? true
    }

    /// The server's rule: the later of each time wins, so the last change per couplet wins.
    func merged(with other: DivanItem) -> DivanItem {
        DivanItem(key: key, keptAt: Self.later(keptAt, other.keptAt), removedAt: Self.later(removedAt, other.removedAt))
    }

    private static func later(_ a: Int64?, _ b: Int64?) -> Int64? {
        switch (a, b) {
        case (let a?, let b?): max(a, b)
        default: a ?? b
        }
    }

    // MARK: Wire format: the times are ISO-8601 strings with milliseconds, as in the contract.

    private enum CodingKeys: String, CodingKey { case key, keptAt, removedAt }

    init(key: String, keptAt: Int64?, removedAt: Int64?) {
        self.key = key
        self.keptAt = keptAt
        self.removedAt = removedAt
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        key = try values.decode(String.self, forKey: .key)
        keptAt = try values.decodeIfPresent(String.self, forKey: .keptAt).flatMap(DivanTime.milliseconds)
        removedAt = try values.decodeIfPresent(String.self, forKey: .removedAt).flatMap(DivanTime.milliseconds)
    }

    func encode(to encoder: any Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(key, forKey: .key)
        try values.encodeIfPresent(keptAt.map(DivanTime.string), forKey: .keptAt)
        try values.encodeIfPresent(removedAt.map(DivanTime.string), forKey: .removedAt)
    }
}

enum DivanTime {
    static func milliseconds(of date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1000).rounded())
    }

    static func date(_ milliseconds: Int64) -> Date {
        Date(timeIntervalSince1970: Double(milliseconds) / 1000)
    }

    /// «2023-11-14T22:13:20.123Z». Built from whole seconds and the milliseconds, so no rounding creeps in.
    static func string(_ milliseconds: Int64) -> String {
        let seconds = milliseconds >= 0 ? milliseconds / 1000 : (milliseconds - 999) / 1000
        let rest = milliseconds - seconds * 1000
        let whole = Date(timeIntervalSince1970: Double(seconds)).formatted(Date.ISO8601FormatStyle())
        return "\(whole.dropLast())." + String(format: "%03d", Int(rest)) + "Z"
    }

    static func milliseconds(_ text: String) -> Int64? {
        let date = (try? Date(text, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)))
            ?? (try? Date(text, strategy: Date.ISO8601FormatStyle()))
        return date.map(milliseconds(of:))
    }
}
