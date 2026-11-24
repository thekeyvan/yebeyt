import GoogleSignIn
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
    @State private var accounts: AccountSetup
    @State private var achievements: Achievements
    @State private var avatar: AvatarStore
    @State private var privacy: PrivacyStore
    @State private var divanSync: DivanSync
    @State private var reactionsSync: ReactionsSync
    @State private var scoreSync: ScoreSync
    @State private var myStats: MyStats
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
        let marks = ReaderMarks()
        _marks = State(initialValue: marks)
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
            tab: options.tab ?? (options.route?.isMe == true ? .me : options.route.map(\.isGames) == true ? .games : screens.isEmpty ? .home : .explore),
            unreadCount: options.unread ?? 0, reader: options.reader, homePath: options.homePath, explorePath: screens, gamesPath: options.gamesPath,
            mePath: options.mePath, game: options.game
        )
        model.autoplay = options.autoplay
        model.leaderboardStart = options.board
        model.peopleStart = options.peopleText
        _model = State(initialValue: model)
        let stats = options.today.map { today in GameStats(now: { today.noon }) } ?? GameStats()
        #else
        _model = State(initialValue: AppModel())
        let stats = GameStats()
        #endif
        _gameStats = State(initialValue: stats)
        let accounts = AccountSetup(stats: stats)
        _accounts = State(initialValue: accounts)
        let achievements = Achievements()
        _achievements = State(initialValue: achievements)
        stats.rightAnswerHandler = { slug in achievements.recordRight(poetSlug: slug) }
        stats.roundHandler = { game, right, total in achievements.recordRound(game: game, right: right, of: total) }
        _avatar = State(initialValue: AvatarStore(session: accounts.session))
        _privacy = State(initialValue: PrivacyStore(session: accounts.session))
        _divanSync = State(initialValue: DivanSync(marks: marks, session: accounts.session))
        _reactionsSync = State(initialValue: ReactionsSync(marks: marks, session: accounts.session))
        let scores = ScoreSync(session: accounts.session)
        let myStats = MyStats(local: stats, session: accounts.session)
        scores.didSend = { Task { await myStats.refresh() } }
        stats.finishedRoundHandler = { kind, points in
            if let game = ScoreGame(kind) { scores.report(game, points: points) }
        }
        stats.finishedDailyHandler = { day, solved, tries, points in scores.reportDaily(on: day, solved: solved, tries: tries, points: points) }
        _scoreSync = State(initialValue: scores)
        _myStats = State(initialValue: myStats)
        #if DEBUG
        if options.seedDivan { marks.seedDivan() }
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
                .environment(achievements)
                .environment(avatar)
                .environment(privacy)
                .environment(divanSync)
                .environment(reactionsSync)
                .environment(scoreSync)
                .environment(myStats)
                .environment(accounts.session)
                .environment(accounts.account)
                .environment(accounts.pictures)
                .environment(accounts.taste)
                .environment(accounts.onboarding)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "fa_IR"))
                .preferredColorScheme(.light)
                .font(.ui(16))
                .tint(Tokens.Colors.lapis)
                .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
                .task {
                    await accounts.session.restore()
                    await accounts.pictures.refreshIfNeeded()
                }
        }
    }

    @ViewBuilder private var content: some View {
        #if DEBUG
        if showsStickers {
            StickerSheet()
        } else {
            main
        }
        #else
        main
        #endif
    }

    /// Onboarding on the first launch, then the tabs.
    @ViewBuilder private var main: some View {
        if accounts.onboarding.isRunning {
            OnboardingFlow()
        } else {
            RootView(model: model)
        }
    }
}
