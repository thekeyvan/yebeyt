import SwiftUI
import UIKit

struct RootView: View {
    @Bindable var model: AppModel
    @Environment(GameStats.self) private var stats
    @Environment(Session.self) private var session
    @Environment(DivanSync.self) private var divanSync
    @Environment(AvatarStore.self) private var avatar
    @Environment(\.scenePhase) private var scenePhase
    @State private var keyboardUp = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                TabPage(model: model)
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        Color.clear.frame(height: keyboardUp || !model.showsTabBar ? 0 : TabBar.footprint)
                    }
                // The bar would ride up on top of the keyboard, so it is hidden while the keyboard is up.
                // The privacy, avatar and invite screens are drawn without it on their boards.
                if !keyboardUp, model.showsTabBar {
                    TabBar(model: model)
                }
                if let held = model.hold { holdMenu(held) }
            }
            .accessibilityHidden(model.game != nil)
            if let game = model.game {
                GameHost(route: game)
                    .id(game.id)
                    .transition(.move(edge: .bottom))
            }
        }
        .animation(.snappy, value: model.game)
        // The bar sits 18pt above the screen edge, as on the board; the pages reserve its height.
        .ignoresSafeArea(.container, edges: .bottom)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardUp = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardUp = false }
        // The Tehran day turns for the games while the app is open, when it comes back, or when the clock is changed.
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(stats.secondsUntilNextDay + 1))
                stats.refreshToday()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                stats.refreshToday()
                Task { await divanSync.syncNow() }
            }
        }
        // The divan syncs when the app starts signed in and right after a sign-in; the avatar is matched with the
        // server's once the user is known.
        .task(id: session.isSignedIn) { await divanSync.syncNow() }
        .task(id: session.user?.id) { await avatar.reconcile(with: session.user) }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in stats.refreshToday() }
        .accountPrompt(host: model.reader == nil)
        .sheet(item: $model.share) { ShareSheet(text: $0.text).presentationDetents([.medium, .large]) }
        .fullScreenCover(item: $model.reader) { route in
            ReaderView(
                route: route, close: { model.closeReader() },
                playWithPoem: { model.playWithPoem(route.path) },
                playWithCouplet: { model.playWithCouplet(poem: route.path, index: $0) },
                openPoet: { model.openPoet(slug: $0) }
            )
        }
    }

    /// A long press on a couplet outside the reader (the divan): the same menu as in the reader.
    private func holdMenu(_ held: HeldCouplet) -> some View {
        HoldMenu(
            held: held, dismiss: { withAnimation(.snappy) { model.hold = nil } },
            share: { model.share = ReaderModel.Share(text: held.shareText) },
            openCouplet: { withMeaning in model.openReader(ReaderRoute(path: held.path, couplet: held.index, meaning: withMeaning)) },
            playWithCouplet: { index in
                model.hold = nil
                model.playWithCouplet(poem: held.path, index: index)
            }
        )
        .transition(.opacity)
    }
}
