import SwiftUI
import UIKit

struct RootView: View {
    @Bindable var model: AppModel
    @Environment(GameStats.self) private var stats
    @Environment(\.scenePhase) private var scenePhase
    @State private var keyboardUp = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                TabPage(model: model)
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        Color.clear.frame(height: keyboardUp ? 0 : TabBar.footprint)
                    }
                // The bar would ride up on top of the keyboard, so it is hidden while the keyboard is up.
                if !keyboardUp {
                    TabBar(model: model)
                }
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
        .onChange(of: scenePhase) { _, phase in if phase == .active { stats.refreshToday() } }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in stats.refreshToday() }
        .fullScreenCover(item: $model.reader) { route in
            ReaderView(
                route: route, close: { model.closeReader() },
                playWithPoem: { model.playWithPoem(route.path) },
                playWithCouplet: { model.playWithCouplet(poem: route.path, index: $0) },
                openPoet: { model.openPoet(slug: $0) }
            )
        }
    }
}
