import SwiftUI

@main
struct YebeytApp: App {
    @State private var model: AppModel
    #if DEBUG
    private let route: LaunchOptions.Route?
    #endif

    init() {
        #if DEBUG
        let options = LaunchOptions.fromProcess
        route = options.route
        _model = State(initialValue: AppModel(tab: options.tab ?? .home, unreadCount: options.unread ?? 0))
        #else
        _model = State(initialValue: AppModel())
        #endif
    }

    var body: some Scene {
        WindowGroup {
            content
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "fa_IR"))
                .preferredColorScheme(.light)
                .font(.ui(16))
                .tint(Tokens.Colors.lapis)
        }
    }

    @ViewBuilder private var content: some View {
        #if DEBUG
        if route == .stickers {
            StickerSheet()
        } else {
            RootView(model: model)
        }
        #else
        RootView(model: model)
        #endif
    }
}
