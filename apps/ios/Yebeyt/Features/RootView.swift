import SwiftUI
import UIKit

struct RootView: View {
    @Bindable var model: AppModel
    @State private var keyboardUp = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabPage(model: model)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    Color.clear.frame(height: keyboardUp ? 0 : TabBar.footprint)
                }
            // The bar would ride up on top of the keyboard, so it is hidden while the keyboard is up.
            if !keyboardUp {
                TabBar(model: model)
            }
        }
        // The bar sits 18pt above the screen edge, as on the board; the pages reserve its height.
        .ignoresSafeArea(.container, edges: .bottom)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardUp = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardUp = false }
        .fullScreenCover(item: $model.reader) { route in
            ReaderView(
                route: route, close: { model.closeReader() }, playWithCouplet: { model.playWithCouplet() },
                openPoet: { model.openPoet(slug: $0) }
            )
        }
    }
}
