import SwiftUI

@main
struct YebeytApp: App {
    @State private var model: AppModel
    @State private var poetry: PoetryStore
    @State private var marks = ReaderMarks()
    @State private var textSettings = TextSettingsStore()
    #if DEBUG
    private let showsStickers: Bool
    #endif

    init() {
        do {
            _poetry = State(initialValue: try PoetryStore())
        } catch {
            fatalError("The bundled poetry data is unreadable: \(error)")  // a packaging bug, not a runtime condition
        }
        #if DEBUG
        let options = LaunchOptions.fromProcess
        showsStickers = options.route == .stickers
        _model = State(initialValue: AppModel(tab: options.tab ?? .home, unreadCount: options.unread ?? 0, reader: options.reader))
        #else
        _model = State(initialValue: AppModel())
        #endif
    }

    var body: some Scene {
        WindowGroup {
            content
                .environment(poetry)
                .environment(marks)
                .environment(textSettings)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "fa_IR"))
                .preferredColorScheme(.light)
                .font(.ui(16))
                .tint(Tokens.Colors.lapis)
        }
    }

    @ViewBuilder private var content: some View {
        #if DEBUG
        if showsStickers {
            StickerSheet()
        } else {
            RootView(model: model)
        }
        #else
        RootView(model: model)
        #endif
    }
}
