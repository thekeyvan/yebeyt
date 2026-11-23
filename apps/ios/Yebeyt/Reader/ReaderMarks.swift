import Foundation
import Observation

/// What the reader has marked on this phone, per couplet: پسند, بازنشر and نگه دار. Stored as JSON in
/// UserDefaults under keys like «/hafez/ghazal/sh3#1» (the poem path and the 0-based couplet index).
/// Until the server exists, these are only local; slice 5 builds the divan screen from `keys(.kept)`.
@MainActor @Observable
final class ReaderMarks {
    enum Mark: String, CaseIterable, Codable, Sendable {
        case liked, reposted, kept
    }

    static let defaultsKey = "reader.marks"

    static func key(poemPath: String, couplet: Int) -> String {
        "\(poemPath)#\(couplet)"
    }

    private var marked: [Mark: Set<String>]
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let saved = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode([Mark: Set<String>].self, from: $0) }
        marked = saved ?? [:]
    }

    func contains(_ mark: Mark, poemPath: String, couplet: Int) -> Bool {
        marked[mark]?.contains(Self.key(poemPath: poemPath, couplet: couplet)) == true
    }

    /// Turns the mark on or off; returns whether it is on now.
    @discardableResult
    func toggle(_ mark: Mark, poemPath: String, couplet: Int) -> Bool {
        let key = Self.key(poemPath: poemPath, couplet: couplet)
        var keys = marked[mark] ?? []
        let isOn = keys.insert(key).inserted
        if !isOn { keys.remove(key) }
        marked[mark] = keys
        if let data = try? JSONEncoder().encode(marked) { defaults.set(data, forKey: Self.defaultsKey) }
        return isOn
    }

    func keys(_ mark: Mark) -> Set<String> {
        marked[mark] ?? []
    }
}
