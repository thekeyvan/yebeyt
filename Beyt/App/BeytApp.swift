import SwiftUI

@main
struct BeytApp: App {
    @State private var library = Library()
    @State private var prefs = Prefs()
    @State private var router = Router()
    @State private var audio = AudioPlayer()

    var body: some SwiftUI.Scene {
        WindowGroup {
            RootView()
                .environment(library)
                .environment(prefs)
                .environment(router)
                .environment(audio)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "fa_IR"))
                .preferredColorScheme(.dark)
                .tint(prefs.accent)
                .font(.ui(15))
        }
    }
}

struct RootView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @Environment(\.scenePhase) private var phase

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            if !library.ready {
                ProgressView().tint(Palette.muted)
            } else if !prefs.onboarded {
                OnboardingView()
                    .transition(.opacity)
            } else {
                MainView()
                    .transition(.opacity)
            }
            if let t = router.toast {
                VStack { Spacer(); Toast(text: t).padding(.bottom, 100) }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .allowsHitTesting(false)
                    .zIndex(10)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: prefs.onboarded)
        .animation(.easeInOut(duration: 0.35), value: library.ready)
        .onChange(of: phase) { _, p in if p == .active { prefs.markToday() } }
        .onChange(of: library.ready) { _, r in if r { debugLaunch() } }
    }

    /// Debug builds only: open a screen straight from launch arguments (used for screenshots).
    private func debugLaunch() {
        #if DEBUG
        let d = UserDefaults.standard
        if d.bool(forKey: "beytSkip") { prefs.onboarded = true }
        if let t = d.string(forKey: "beytTab"), let tab = Tab(rawValue: t) { router.tab = tab }
        if let r = d.string(forKey: "beytRoute") {
            let parts = r.split(separator: ":", maxSplits: 1).map(String.init)
            switch parts[0] {
            case "poem": router.openPoem(parts[1], layout: d.string(forKey: "beytLayout"))
            case "play": router.openPoem(parts[1], play: true)
            case "mood": router.open(.mood(parts[1]))
            case "book": router.open(.book(parts[1]))
            case "fal": router.open(.fal)
            case "search": router.open(.search)
            default: break
            }
        }
        if let s = d.string(forKey: "beytSheet") {
            let parts = s.split(separator: ":", maxSplits: 1).map(String.init)
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(900))
                switch parts[0] {
                case "poet": router.show(.poet(parts[1]))
                case "share": router.show(.share(parts[1], 0))
                case "couplet": router.show(.couplet(parts[1], 0))
                case "font": router.show(.font)
                case "more": router.show(.more(parts[1]))
                default: break
                }
            }
        }
        #endif
    }
}

struct MainView: View {
    @Environment(Router.self) private var router
    @Environment(Prefs.self) private var prefs

    var body: some View {
        @Bindable var router = router
        NavigationStack(path: $router.path) {
            ZStack(alignment: .bottom) {
                Group {
                    switch router.tab {
                    case .home: HomeView()
                    case .library: LibraryView()
                    case .me: MeView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                TabBar()
            }
            .background(Palette.bg)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { r in
                Group {
                    switch r {
                    case let .poem(url, focus, play, layout): ReaderView(url: url, focus: focus, autoplay: play, layout: layout)
                    case let .mood(k): MoodDeckView(key: k)
                    case .search: SearchView()
                    case .fal: FalView()
                    case let .book(u): BookView(url: u)
                    }
                }
                .toolbar(.hidden, for: .navigationBar)
                .background(Palette.bg)
            }
        }
        .sheet(item: $router.sheet) { s in
            SheetHost(route: s)
                .environment(\.layoutDirection, .rightToLeft)
                .presentationDragIndicator(.visible)
                .presentationBackground(Palette.bg)
                .presentationCornerRadius(28)
        }
    }
}

/// Floating glass tab bar with the search button beside it.
struct TabBar: View {
    @Environment(Router.self) private var router
    @Environment(Prefs.self) private var prefs

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 2) {
                ForEach(Tab.allCases, id: \.self) { t in
                    let on = router.tab == t
                    Button { withAnimation(.easeInOut(duration: 0.25)) { router.go(t) } } label: {
                        VStack(spacing: 2) {
                            AppIcon(on ? t.icon + ".fill" : t.icon, size: 18)
                            Text(t.title).font(.ui(11, .medium))
                        }
                        .foregroundStyle(on ? prefs.accent : Palette.muted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Capsule().fill(on ? prefs.accent.opacity(0.15) : .clear))
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(6)
            .frame(height: 62)
            .glass(Capsule(), interactive: true)
            Button { router.open(.search) } label: {
                AppIcon("magnifyingglass", size: 20).foregroundStyle(Palette.ink)
                    .frame(width: 62, height: 62)
                    .glass(Circle(), interactive: true)
            }
            .buttonStyle(PressStyle(scale: 0.93))
            .accessibilityLabel("جستجو")
        }
        .shadow(color: .black.opacity(0.4), radius: 17, y: 14)
        .padding(.horizontal, 12)
        .padding(.bottom, 4)
    }
}

// Keep the edge swipe-back gesture working with the hidden navigation bar.
extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }
    public func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool { viewControllers.count > 1 }
}
