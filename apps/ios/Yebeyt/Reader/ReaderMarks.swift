import Foundation
import Observation

/// What the reader has marked on this phone, per couplet: پسند, بازنشر and نگه دار. Keys look like
/// «/hafez/ghazal/sh3#1» (the poem path and the 0-based couplet index).
///
/// پسند and بازنشر are only local for now (JSON in UserDefaults). نگه دار is the divan: each couplet has the time
/// it was kept and the time it was taken out (`DivanItem`), kept as its own JSON, so that it can be merged with
/// the server's divan (`DivanSync`). Couplets kept before the times existed get the time of the first launch
/// that knows about them.
@MainActor @Observable
final class ReaderMarks {
    enum Mark: String, CaseIterable, Codable, Sendable {
        case liked, reposted, kept
    }

    static let defaultsKey = "reader.marks"
    static let divanKey = "reader.divan"

    nonisolated static func key(poemPath: String, couplet: Int) -> String {
        "\(poemPath)#\(couplet)"
    }

    private var marked: [Mark: Set<String>]
    private var divan: [String: DivanItem]
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let now: () -> Date
    /// Called after the person keeps or un-keeps a couplet (not after a merge from the server).
    @ObservationIgnored var keptDidChange: (@MainActor () -> Void)?

    init(defaults: UserDefaults = .standard, now: @escaping () -> Date = { .now }) {
        self.defaults = defaults
        self.now = now
        var saved = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode([Mark: Set<String>].self, from: $0) } ?? [:]
        var items = defaults.data(forKey: Self.divanKey).flatMap { try? JSONDecoder().decode([DivanItem].self, from: $0) } ?? []
        let old = saved.removeValue(forKey: .kept) ?? []
        if !old.isEmpty {
            let stamp = DivanTime.milliseconds(of: now())
            let known = Set(items.map(\.key))
            items += old.subtracting(known).sorted().map { DivanItem(key: $0, keptAt: stamp, removedAt: nil) }
        }
        marked = saved
        divan = Dictionary(items.map { ($0.key, $0) }, uniquingKeysWith: { $0.merged(with: $1) })
        if !old.isEmpty {
            saveMarks()
            saveDivan()
        }
    }

    func contains(_ mark: Mark, poemPath: String, couplet: Int) -> Bool {
        let key = Self.key(poemPath: poemPath, couplet: couplet)
        return mark == .kept ? divan[key]?.isKept == true : marked[mark]?.contains(key) == true
    }

    /// Turns the mark on or off; returns whether it is on now.
    @discardableResult
    func toggle(_ mark: Mark, poemPath: String, couplet: Int) -> Bool {
        let key = Self.key(poemPath: poemPath, couplet: couplet)
        if mark == .kept { return toggleKept(key) }
        var keys = marked[mark] ?? []
        let isOn = keys.insert(key).inserted
        if !isOn { keys.remove(key) }
        marked[mark] = keys
        saveMarks()
        return isOn
    }

    func keys(_ mark: Mark) -> Set<String> {
        mark == .kept ? Set(divan.values.filter(\.isKept).map(\.key)) : marked[mark] ?? []
    }

    // MARK: The divan

    /// Every couplet the divan has a record of, the removed ones too, by key.
    var divanItems: [DivanItem] {
        divan.values.sorted { $0.key < $1.key }
    }

    /// The couplets that are kept now, the newest first.
    var keptItems: [DivanItem] {
        divan.values.filter(\.isKept).sorted { ($0.keptAt ?? 0, $1.key) > ($1.keptAt ?? 0, $0.key) }
    }

    /// Merges what the server has (or another source): the later of each time wins.
    func apply(_ items: [DivanItem]) {
        var changed = false
        for item in items {
            let merged = divan[item.key].map { $0.merged(with: item) } ?? item
            if merged != divan[item.key] {
                divan[item.key] = merged
                changed = true
            }
        }
        if changed { saveDivan() }
    }

    /// Forgets the divan and its times (after the account is deleted).
    func clearDivan() {
        divan = [:]
        defaults.removeObject(forKey: Self.divanKey)
    }

    private func toggleKept(_ key: String) -> Bool {
        let stamp = DivanTime.milliseconds(of: now())
        var item = divan[key] ?? DivanItem(key: key, keptAt: nil, removedAt: nil)
        let isOn = !item.isKept
        if isOn { item.keptAt = max(stamp, (item.removedAt ?? 0) + 1) } else { item.removedAt = max(stamp, item.keptAt ?? 0) }
        divan[key] = item
        saveDivan()
        keptDidChange?()
        return isOn
    }

    private func saveMarks() {
        if let data = try? JSONEncoder().encode(marked) { defaults.set(data, forKey: Self.defaultsKey) }
    }

    private func saveDivan() {
        if let data = try? JSONEncoder().encode(divanItems) { defaults.set(data, forKey: Self.divanKey) }
    }
}
