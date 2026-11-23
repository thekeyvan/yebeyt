import SwiftUI

/// The full-screen reader over the tabs: the shared header and mode toggle, then the couplet page or the whole
/// poem, with the «آ» sheet and the lifted-couplet menu on top. Closed with the round chevron button.
struct ReaderView: View {
    @Environment(PoetryStore.self) private var store
    @Environment(TextSettingsStore.self) private var text
    @State private var model: ReaderModel
    let close: () -> Void
    let playWithCouplet: () -> Void

    init(route: ReaderRoute, close: @escaping () -> Void, playWithCouplet: @escaping () -> Void) {
        _model = State(initialValue: ReaderModel(route: route))
        self.close = close
        self.playWithCouplet = playWithCouplet
    }

    var body: some View {
        let theme = text.settings.theme
        ZStack {
            theme.background.ignoresSafeArea()
            page(theme)
                .blur(radius: model.holdIndex == nil ? 0 : 3)
                .accessibilityHidden(model.holdIndex != nil || model.textSheetOpen)
            if model.phase == .loaded, model.mode == .couplet { rail(theme) }
            if model.textSheetOpen { textSheet }
            if let held = model.holdIndex, model.couplets.indices.contains(held) {
                HoldMenu(model: model, couplet: held, dismiss: { withAnimation(.snappy) { model.holdIndex = nil } }, playWithCouplet: playWithCouplet)
                    .transition(.opacity)
            }
        }
        .overlay(alignment: .bottom) { toast }
        .animation(.snappy, value: model.holdIndex)
        .animation(.snappy, value: model.textSheetOpen)
        .animation(.snappy, value: model.toast)
        .sheet(item: $model.share) { ShareSheet(text: $0.text).presentationDetents([.medium, .large]) }
        .environment(\.layoutDirection, .rightToLeft)
        .preferredColorScheme(theme.isDark ? .dark : .light)  // light status bar text on the dark theme
        .task { await model.load(using: store) }
        .onDisappear { model.close() }
    }

    private func page(_ theme: ReaderTheme) -> some View {
        VStack(spacing: 8) {
            ReaderHeader(model: model, theme: theme, close: close, playWithCouplet: playWithCouplet)
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
                    if let active { withAnimation(.snappy) { model.go(to: active) } }
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

    private var textSheet: some View {
        ZStack(alignment: .bottom) {
            Tokens.Colors.ink.opacity(0.12)
                .ignoresSafeArea()
                .onTapGesture { model.textSheetOpen = false }
                .accessibilityHidden(true)
            TextSheet { model.textSheetOpen = false }
                .transition(.move(edge: .bottom))
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(.escape) { model.textSheetOpen = false }
    }

    @ViewBuilder private var toast: some View {
        if let message = model.toast {
            Text(message)
                .font(.ui(13, weight: .medium))
                .foregroundStyle(Tokens.Colors.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 9)
                .background(Capsule().fill(Tokens.Colors.ink))
                .padding(.bottom, 96)
                .transition(.opacity)
        }
    }
}
