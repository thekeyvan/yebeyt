import SwiftUI

@main
struct YebeytApp: App {
    @State private var model: AppModel
    @State private var poetry: PoetryStore
    @State private var library: Library
    @State private var progress: ReadingProgress
    @State private var follows: Follows
    @State private var corpus = CorpusStore()
    @State private var marks: ReaderMarks
    @State private var textSettings = TextSettingsStore()
    #if DEBUG
    private let showsStickers: Bool
    #endif

    init() {
        #if DEBUG
        let options = LaunchOptions.fromProcess
        if options.fresh { LaunchOptions.resetSavedState() }
        #endif
        _progress = State(initialValue: ReadingProgress())
        _follows = State(initialValue: Follows())
        _marks = State(initialValue: ReaderMarks())
        do {
            _poetry = State(initialValue: try PoetryStore())
        } catch {
            fatalError("The bundled poetry data is unreadable: \(error)")  // a packaging bug, not a runtime condition
        }
        let library: Library
        do {
            library = try Library()
        } catch {
            fatalError("The bundled library data is unreadable: \(error)")  // a packaging bug, not a runtime condition
        }
        _library = State(initialValue: library)
        #if DEBUG
        showsStickers = options.route == .stickers
        let screens = options.destinations(in: library)
        _model = State(initialValue: AppModel(
            tab: options.tab ?? (screens.isEmpty ? .home : .explore), unreadCount: options.unread ?? 0,
            reader: options.reader, explorePath: screens
        ))
        #else
        _model = State(initialValue: AppModel())
        #endif
    }

    var body: some Scene {
        WindowGroup {
            content
                .environment(model)
                .environment(poetry)
                .environment(library)
                .environment(progress)
                .environment(follows)
                .environment(corpus)
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
