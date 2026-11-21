import SwiftUI
import Observation

/// Everything the reader chose or did, saved on the device.
@Observable
final class Prefs {
    struct Recent: Codable, Hashable { let url: String; var couplet: Int }

    private struct Stored: Codable {
        var onboarded = false
        var saved: [String] = []
        var font: VerseFont = .parastoo
        var size: Double = 1
        var meanings = true
        var accent: Accent = .firuze
        var vibes: [String] = []
        var layout = "focus"
        var recent: [Recent] = []
        var seen: [String] = []
        var days: [String] = []
        var hinted = false
        var reciter: [String: Int] = [:]
    }

    private var s: Stored { didSet { persist() } }
    private static let key = "beyt.prefs.v1"

    init() {
        if let d = UserDefaults.standard.data(forKey: Prefs.key), let v = try? JSONDecoder().decode(Stored.self, from: d) {
            s = v
        } else {
            s = Stored()
        }
        markToday()
    }

    private func persist() {
        if let d = try? JSONEncoder().encode(s) { UserDefaults.standard.set(d, forKey: Prefs.key) }
    }

    // MARK: settings
    var onboarded: Bool { get { s.onboarded } set { s.onboarded = newValue } }
    var font: VerseFont { get { s.font } set { s.font = newValue } }
    var size: Double { get { s.size } set { s.size = newValue } }
    var meanings: Bool { get { s.meanings } set { s.meanings = newValue } }
    var accentChoice: Accent { get { s.accent } set { s.accent = newValue } }
    var accent: Color { s.accent.color }
    var onAccent: Color { s.accent.onColor }
    var vibes: [String] { get { s.vibes } set { s.vibes = newValue } }
    var layout: String { get { s.layout } set { s.layout = newValue } }
    var hinted: Bool { get { s.hinted } set { s.hinted = newValue } }
    func reciter(for url: String) -> Int { s.reciter[url] ?? 0 }
    func setReciter(_ i: Int, for url: String) { s.reciter[url] = i }

    // MARK: saved couplets
    var saved: [CoupletRef] { s.saved.compactMap(CoupletRef.init(key:)) }
    func isSaved(_ r: CoupletRef) -> Bool { s.saved.contains(r.key) }
    @discardableResult func toggleSave(_ r: CoupletRef) -> Bool {
        if isSaved(r) { s.saved.removeAll { $0 == r.key }; return false }
        s.saved.insert(r.key, at: 0); return true
    }

    // MARK: reading history
    var recent: [Recent] { s.recent }
    func remember(_ url: String, couplet: Int) {
        var list = s.recent.filter { $0.url != url }
        list.insert(Recent(url: url, couplet: couplet), at: 0)
        s.recent = Array(list.prefix(12))
    }
    var readCount: Int { s.seen.count }
    func markSeen(_ r: CoupletRef) {
        guard !s.seen.contains(r.key) else { return }
        s.seen.append(r.key)
    }

    /// Days in a row the app was opened, counting today.
    var streak: Int {
        let set = Set(s.days)
        var n = 0
        var d = Date.now
        let cal = Calendar(identifier: .gregorian)
        while set.contains(Prefs.dayKey(d)) {
            n += 1
            guard let prev = cal.date(byAdding: .day, value: -1, to: d) else { break }
            d = prev
        }
        return max(n, 1)
    }
    func markToday() {
        let k = Prefs.dayKey(.now)
        if !s.days.contains(k) { s.days.append(k); s.days = Array(s.days.suffix(400)) }
    }
    private static func dayKey(_ d: Date) -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: d)
        return "\(c.year ?? 0)-\(c.month ?? 0)-\(c.day ?? 0)"
    }

    // MARK: verse typography
    func verseFont(_ base: CGFloat) -> Font { .custom(font.postScript, size: base * font.factor * size) }
    func verseSpacing(_ base: CGFloat) -> CGFloat { base * font.factor * size * font.leading }
    func meaningSize(_ base: CGFloat) -> CGFloat { base * size }

    func resetOnboarding() { s.onboarded = false }
}
