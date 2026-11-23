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
    @State private var deck: GameDeck
    @State private var gameStats: GameStats
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
        do {
            let names = Dictionary(library.poets.map { ($0.slug, $0.name) }, uniquingKeysWith: { first, _ in first })
            _deck = State(initialValue: try GameDeck(poetNames: names))
        } catch {
            fatalError("The bundled game deck is unreadable: \(error)")  // a packaging bug, not a runtime condition
        }
        #if DEBUG
        showsStickers = options.route == .stickers
        let screens = options.destinations(in: library)
        let model = AppModel(
            tab: options.tab ?? (options.route.map(\.isGames) == true ? .games : screens.isEmpty ? .home : .explore),
            unreadCount: options.unread ?? 0, reader: options.reader, explorePath: screens, gamesPath: options.gamesPath, game: options.game
        )
        model.autoplay = options.autoplay
        _model = State(initialValue: model)
        _gameStats = State(initialValue: options.today.map { today in GameStats(now: { today.noon }) } ?? GameStats())
        #else
        _model = State(initialValue: AppModel())
        _gameStats = State(initialValue: GameStats())
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
                .environment(deck)
                .environment(gameStats)
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
