import SwiftUI
import Observation

/// Everything the reader chose or did, saved on the device.
@Observable
final class Prefs {
    struct Recent: Codable, Hashable { let url: String; var couplet: Int }

    private struct Stored: Codable {
        var onboarded = false
        var saved: [String] = []
        /// When each couplet was kept / let go (seconds since 1970), so removals sync between devices.
        var savedAt: [String: Double] = [:]
        var unsavedAt: [String: Double] = [:]
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

        init() {}
        // Tolerant decoding: fields added in later versions fall back to their defaults.
        init(from d: Decoder) throws {
            let c = try d.container(keyedBy: CodingKeys.self)
            let x = Stored()
            onboarded = (try? c.decodeIfPresent(Bool.self, forKey: .onboarded)) ?? x.onboarded
            saved = (try? c.decodeIfPresent([String].self, forKey: .saved)) ?? x.saved
            savedAt = (try? c.decodeIfPresent([String: Double].self, forKey: .savedAt)) ?? x.savedAt
            unsavedAt = (try? c.decodeIfPresent([String: Double].self, forKey: .unsavedAt)) ?? x.unsavedAt
            font = (try? c.decodeIfPresent(VerseFont.self, forKey: .font)) ?? x.font
            size = (try? c.decodeIfPresent(Double.self, forKey: .size)) ?? x.size
            meanings = (try? c.decodeIfPresent(Bool.self, forKey: .meanings)) ?? x.meanings
            accent = (try? c.decodeIfPresent(Accent.self, forKey: .accent)) ?? x.accent
            vibes = (try? c.decodeIfPresent([String].self, forKey: .vibes)) ?? x.vibes
            layout = (try? c.decodeIfPresent(String.self, forKey: .layout)) ?? x.layout
            recent = (try? c.decodeIfPresent([Recent].self, forKey: .recent)) ?? x.recent
            seen = (try? c.decodeIfPresent([String].self, forKey: .seen)) ?? x.seen
            days = (try? c.decodeIfPresent([String].self, forKey: .days)) ?? x.days
            hinted = (try? c.decodeIfPresent(Bool.self, forKey: .hinted)) ?? x.hinted
            reciter = (try? c.decodeIfPresent([String: Int].self, forKey: .reciter)) ?? x.reciter
        }
    }

    /// What follows the reader across devices once signed in.
    struct SyncState: Codable, Equatable {
        var saved: [String]
        var savedAt: [String: Double]
        var unsavedAt: [String: Double]
        var seen: [String]
        var days: [String]
        var recent: [Recent]
        var reciter: [String: Int]
        var vibes: [String]
    }

    /// Called after any change (the account store uses it to schedule a sync).
    @ObservationIgnored var onChange: (() -> Void)?

    private var s: Stored { didSet { persist(); onChange?() } }
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
        let now = Date.now.timeIntervalSince1970
        if isSaved(r) {
            s.saved.removeAll { $0 == r.key }
            s.unsavedAt[r.key] = now
            return false
        }
        s.saved.insert(r.key, at: 0)
        s.savedAt[r.key] = now
        return true
    }

    // MARK: sync

    var syncState: SyncState {
        SyncState(saved: s.saved, savedAt: s.savedAt, unsavedAt: s.unsavedAt, seen: s.seen, days: s.days, recent: s.recent, reciter: s.reciter, vibes: s.vibes)
    }

    /// Merges what another device saved: union of everything, with "let go" winning only if it came later.
    func merge(_ remote: SyncState) {
        let local = syncState
        var savedAt = local.savedAt.merging(remote.savedAt, uniquingKeysWith: max)
        let unsavedAt = local.unsavedAt.merging(remote.unsavedAt, uniquingKeysWith: max)
        var keys = Set(local.saved).union(remote.saved)
        for k in keys where savedAt[k] == nil { savedAt[k] = 1 } // kept before timestamps existed
        keys = keys.filter { (savedAt[$0] ?? 0) > (unsavedAt[$0] ?? 0) }
        // Most recent first; ties keep the local order.
        let order = Dictionary(local.saved.enumerated().map { ($1, $0) }, uniquingKeysWith: min)
        let saved = keys.sorted { a, b in
            let ta = savedAt[a] ?? 0, tb = savedAt[b] ?? 0
            return ta != tb ? ta > tb : (order[a] ?? .max) < (order[b] ?? .max)
        }
        var recent: [Recent] = []
        for r in local.recent + remote.recent where !recent.contains(where: { $0.url == r.url }) { recent.append(r) }
        var seen = local.seen
        let seenSet = Set(seen)
        seen += remote.seen.filter { !seenSet.contains($0) }
        let next = SyncState(saved: saved, savedAt: savedAt, unsavedAt: unsavedAt, seen: seen,
                             days: Array(Set(local.days).union(remote.days)).sorted().suffix(400).map { $0 },
                             recent: Array(recent.prefix(12)),
                             reciter: remote.reciter.merging(local.reciter) { _, l in l },
                             vibes: local.vibes + remote.vibes.filter { !local.vibes.contains($0) })
        guard next != local else { return }
        var st = s
        st.saved = next.saved; st.savedAt = next.savedAt; st.unsavedAt = next.unsavedAt
        st.seen = next.seen; st.days = next.days; st.recent = next.recent; st.reciter = next.reciter; st.vibes = next.vibes
        s = st
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
