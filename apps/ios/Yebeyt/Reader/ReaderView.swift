import SwiftUI

/// The full-screen reader over the tabs: the shared header and mode toggle, then the couplet page or the whole
/// poem, with the «آ» sheet and the lifted-couplet menu on top. Closed with the round chevron button.
struct ReaderView: View {
    @Environment(PoetryStore.self) private var store
    @Environment(TextSettingsStore.self) private var text
    @Environment(ReadingProgress.self) private var progress
    @Environment(Library.self) private var library
    @Environment(AppModel.self) private var app
    @State private var model: ReaderModel
    @State private var sharedTarget: SharedDivanTarget?
    let close: () -> Void
    let playWithPoem: () -> Void
    let playWithCouplet: (Int) -> Void
    let openPoet: (String) -> Void

    init(
        route: ReaderRoute, close: @escaping () -> Void, playWithPoem: @escaping () -> Void,
        playWithCouplet: @escaping (Int) -> Void, openPoet: @escaping (String) -> Void
    ) {
        _model = State(initialValue: ReaderModel(route: route))
        self.close = close
        self.playWithPoem = playWithPoem
        self.playWithCouplet = playWithCouplet
        self.openPoet = openPoet
    }

    var body: some View {
        let theme = text.settings.theme
        ZStack {
            theme.background.ignoresSafeArea()
            page(theme)
                .blur(radius: model.holdIndex == nil ? 0 : 3)
                .accessibilityHidden(model.holdIndex != nil)
            if model.phase == .loaded, model.mode == .couplet { rail(theme) }
            if let index = model.holdIndex, let held = model.held(index) {
                HoldMenu(
                    held: held, dismiss: { withAnimation(Motion.bouncy) { model.holdIndex = nil } },
                    share: { model.shareCouplet(index) },
                    openCouplet: { withMeaning in withAnimation(.snappy) { model.openCouplet(index, withMeaning: withMeaning) } },
                    playWithCouplet: { index in app.startGame { playWithCouplet(index) } },
                    addToSharedDivan: {
                        model.holdIndex = nil
                        sharedTarget = SharedDivanTarget(key: ReaderMarks.key(poemPath: model.path, couplet: index), person: nil)
                    },
                    offerUndo: { model.showToast($0, undo: $1) }
                )
                .motionTransition { Motion.menu($0, anchor: HoldMenu.origin) }
            }
        }
        .overlay(alignment: .bottom) { toast }
        .animation(Motion.bouncy, value: model.holdIndex)
        .animation(Motion.bouncy, value: model.toast)
        .sheet(isPresented: $model.textSheetOpen) {
            // The page behind stays lit and live: every change of the text shows on it at once.
            TextSheet { model.textSheetOpen = false }
                .presentationBackgroundInteraction(.enabled)
        }
        .sheet(item: $model.share) { ShareSheet(text: $0.text).presentationDetents([.medium, .large]) }
        .sharedDivanSheet(item: $sharedTarget) { model.showToast($0) }
        .leaveGameQuestion(app)
        .background { Color.clear.accountPrompt(host: true) }
        .environment(\.layoutDirection, .rightToLeft)
        .preferredColorScheme(theme.isDark ? .dark : .light)  // light status bar text on the dark theme
        .task { await model.load(using: store) }
        .onChange(of: model.phase) { _, _ in recordProgress() }
        .onChange(of: model.index) { _, _ in recordProgress() }
        .onChange(of: model.topIndex) { _, _ in recordProgress() }
        .onChange(of: model.reachedEnd) { _, reached in if reached { progress.reachedEnd(path: model.path, count: model.couplets.count) } }
        .onAppear { FeedbackLog.shared.reader = model }
        .onDisappear {
            model.close()
            if FeedbackLog.shared.reader === model { FeedbackLog.shared.reader = nil }
        }
    }

    /// The subtitle's tap: the poet's page, when the library has one.
    private var poetAction: (() -> Void)? {
        guard let slug = model.content?.poetSlug, library.poet(slug: slug) != nil else { return nil }
        return { openPoet(slug) }
    }

    /// Remembers where the reader is, for «ادامه» and «خوندی»: the couplet on the page, or the one at the top of the list.
    private func recordProgress() {
        guard model.phase == .loaded, let content = model.content else { return }
        progress.opened(path: model.path, couplet: model.actionIndex, count: content.poem.couplets.count, title: content.title)
    }

    private func page(_ theme: ReaderTheme) -> some View {
        VStack(spacing: 8) {
            ReaderHeader(model: model, theme: theme, close: close, playWithPoem: { app.startGame(playWithPoem) }, openPoet: poetAction)
            switch model.phase {
            case .loading:
                Spacer()
            case .failed:
                failure
            case .loaded:
                content
            }
        }
        .ignoresSafeArea(.container, edges: .bottom)
    }

    @ViewBuilder private var content: some View {
        switch model.mode {
        case .couplet:
            CoupletModeView(model: model)
                .onChange(of: model.player?.activeCouplet) { _, active in
                    if let active { withAnimation(.snappy) { model.follow(active) } }
                }
        case .scroll:
            WholePoemView(model: model)
        }
    }

    /// At the left edge, in the middle of the screen. `.trailing` is the physical left in right-to-left.
    private func rail(_ theme: ReaderTheme) -> some View {
        ProgressRail(index: model.index, count: model.couplets.count, theme: theme)
            .padding(.trailing, 17)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }

    private var failure: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("شعر باز نشد").font(.title(24)).foregroundStyle(text.settings.theme.foreground)
            Button("دوباره") { Task { await model.load(using: store) } }
                .buttonStyle(.sticker(.secondary))
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder private var toast: some View {
        if let message = model.toast {
            MessageToast(text: message, undo: model.toastUndo, dismiss: { model.dismissToast() })
                .padding(.bottom, 96)
        }
    }
}
