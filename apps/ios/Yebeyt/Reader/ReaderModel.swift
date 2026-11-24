import Foundation
import Observation

/// The state of one open poem in the reader: loading, the mode, the current couplet, the meaning card,
/// the sheets and the recitation. The views only draw it and call its methods.
@MainActor @Observable
final class ReaderModel {
    enum Phase { case loading, failed, loaded }

    struct Content {
        var poem: Poem
        var poet: String
        /// The poet's slug in the library, when the poet is known (the subtitle opens their page).
        var poetSlug: String?
        var book: String?
        var title: String { ReaderText.shortTitle(poem.title) }
        var subtitle: String { ReaderText.subtitle(poet: poet, book: book) }
    }

    /// What the iOS share sheet shows.
    struct Share: Identifiable {
        let id = UUID()
        let text: String
    }

    let route: ReaderRoute
    private(set) var phase = Phase.loading
    private(set) var content: Content?
    private(set) var player: RecitationPlayer?
    private(set) var toast: String?

    private(set) var mode: ReaderMode
    private(set) var index: Int
    /// The couplet at the top of the whole-poem list, which بفرست and نگه دار act on in that mode.
    var topIndex = 0
    var meaningOpen = false
    var meaningExpanded = false
    var textSheetOpen: Bool
    var holdIndex: Int?
    var share: Share?
    /// Set when the whole-poem list has been scrolled to its last couplet.
    private(set) var reachedEnd = false

    @ObservationIgnored private var toastTask: Task<Void, Never>?
    @ObservationIgnored private let makeEngine: MakeRecitationEngine
    @ObservationIgnored private let fetchTiming: @Sendable (URL) async throws -> Data

    init(
        route: ReaderRoute, makeEngine: @escaping MakeRecitationEngine = AVRecitationEngine.make,
        fetchTiming: @escaping @Sendable (URL) async throws -> Data = { try await URLSession.shared.data(from: $0).0 }
    ) {
        self.route = route
        self.makeEngine = makeEngine
        self.fetchTiming = fetchTiming
        mode = route.mode
        index = route.couplet
        textSheetOpen = route.textSheet
    }

    var couplets: [Couplet] { content?.poem.couplets ?? [] }
    var path: String { route.path }

    /// The couplet the actions act on: the one on the page, or the one at the top of the list.
    var actionIndex: Int { mode == .couplet ? index : topIndex }

    func load(using store: PoetryStore) async {
        phase = .loading
        do {
            let poem = try await store.poem(path: route.path)
            let poet = store.poets.first { route.path.hasPrefix("/\($0.slug)/") }
            let bookPath = route.path.split(separator: "/", omittingEmptySubsequences: false).dropLast().joined(separator: "/")
            var book = poet?.books.first { $0.path == bookPath }?.title
            if book == nil { book = try? await store.book(path: bookPath).title }
            let content = Content(poem: poem, poet: poet?.nickname ?? "", poetSlug: poet?.slug, book: book)
            self.content = content
            index = CoupletPaging.clamp(route.couplet, count: poem.couplets.count)
            topIndex = index
            meaningOpen = route.meaning && couplets.indices.contains(index) && couplets[index].meaning != nil
            holdIndex = route.hold.flatMap { couplets.indices.contains($0) ? $0 : nil }
            let player = RecitationPlayer(
                couplets: poem.couplets, title: content.title, artist: content.poet,
                fetchRecitations: { [poemId = poem.id] in try await store.recitations(poemId: poemId) },
                fetchTiming: fetchTiming, makeEngine: makeEngine,
                onFailure: { [weak self] in self?.showToast("خوانش باز نشد") }
            )
            self.player = player
            phase = .loaded
            await player.prefetch()
        } catch {
            phase = .failed
        }
    }

    /// The mode toggle: each mode starts where the other one was.
    func setMode(_ new: ReaderMode) {
        guard new != mode else { return }
        if new == .scroll { topIndex = index } else { index = CoupletPaging.clamp(topIndex, count: couplets.count) }
        closeMeaning()
        mode = new
    }

    // MARK: Couplet mode

    /// The user moved to a couplet (a swipe or page): the meaning card closes, as it belongs to the couplet it was
    /// opened on, and a recitation that is playing or paused goes to where that couplet starts.
    func go(to newIndex: Int) {
        let clamped = CoupletPaging.clamp(newIndex, count: couplets.count)
        guard clamped != index else { return }
        index = clamped
        closeMeaning()
        player?.seek(toCouplet: clamped)
    }

    /// The recitation reached a couplet and the page follows it. Unlike `go(to:)` it never seeks: the audio is
    /// already there, and seeking would loop.
    func follow(_ couplet: Int) {
        let clamped = CoupletPaging.clamp(couplet, count: couplets.count)
        guard clamped != index else { return }
        index = clamped
        closeMeaning()
    }

    /// The play button: starts the recitation at the couplet being shown (the page, or the top of the list), or
    /// pauses and resumes it.
    func togglePlayback() {
        player?.toggle(startingAt: actionIndex)
    }

    /// Couplet mode at a couplet, from the whole-poem list or the lifted couplet's menu.
    func openCouplet(_ target: Int, withMeaning: Bool = false) {
        mode = .couplet
        holdIndex = nil
        index = CoupletPaging.clamp(target, count: couplets.count)
        meaningExpanded = false
        meaningOpen = withMeaning && hasMeaning(index)
        player?.seek(toCouplet: index)
    }

    /// The whole-poem list shows its last couplet: the poem is read.
    func markReachedEnd() {
        reachedEnd = true
    }

    func hasMeaning(_ couplet: Int) -> Bool {
        couplets.indices.contains(couplet) && couplets[couplet].meaning != nil
    }

    func openMeaning() {
        meaningOpen = hasMeaning(index)
    }

    func closeMeaning() {
        meaningOpen = false
        meaningExpanded = false
    }

    // MARK: Actions

    func shareCouplet(_ couplet: Int) {
        guard let content, content.poem.couplets.indices.contains(couplet) else { return }
        share = Share(text: ReaderText.shareText(content.poem.couplets[couplet], poet: content.poet, title: content.title))
    }

    func copyText(of couplet: Int) -> String? {
        guard let content, content.poem.couplets.indices.contains(couplet) else { return nil }
        return ReaderText.copyText(content.poem.couplets[couplet], poet: content.poet)
    }

    func caption(for couplet: Int) -> String {
        ReaderText.caption(poet: content?.poet ?? "", title: content?.title ?? "", index: couplet)
    }

    /// The couplet a long press lifts, for the hold menu.
    func held(_ couplet: Int) -> HeldCouplet? {
        guard let content, content.poem.couplets.indices.contains(couplet) else { return nil }
        let lines = content.poem.couplets[couplet]
        return HeldCouplet(
            path: path, index: couplet, couplet: lines, caption: caption(for: couplet),
            shareText: ReaderText.shareText(lines, poet: content.poet, title: content.title),
            copyText: ReaderText.copyText(lines, poet: content.poet)
        )
    }

    func showToast(_ text: String) {
        toast = text
        toastTask?.cancel()
        toastTask = Task {
            try? await Task.sleep(for: .seconds(2.5))
            if !Task.isCancelled { toast = nil }
        }
    }

    func close() {
        player?.stop()
    }
}
