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
    @State private var textSettings: TextSettingsStore
    @State private var deck: GameDeck
    @State private var gameStats: GameStats
    @State private var accounts: AccountSetup
    @State private var achievements: Achievements
    @State private var avatar: AvatarStore
    @State private var privacy: PrivacyStore
    @State private var divanSync: DivanSync
    @State private var feedback: FeedbackCenter
    @State private var messages: MessagesCenter
    @State private var resolver: CoupletResolver
    #if DEBUG
    private let showsStickers: Bool
    private let feedbackOpen: FeedbackLaunchOptions.Open?
    #endif

    init() {
        #if DEBUG
        let options = LaunchOptions.fromProcess
        if options.fresh { LaunchOptions.resetSavedState() }
        #endif
        NetworkMonitor.shared.start()
        ScreenRecorder.removeStaleFiles()
        let textSettings = TextSettingsStore()
        _textSettings = State(initialValue: textSettings)
        _progress = State(initialValue: ReadingProgress())
        _follows = State(initialValue: Follows())
        let marks = ReaderMarks()
        _marks = State(initialValue: marks)
        do {
            let store = try PoetryStore()
            _poetry = State(initialValue: store)
            _resolver = State(initialValue: CoupletResolver(store: store))
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
        let appModel = AppModel(
            tab: options.tab ?? (options.route?.isMe == true ? .me : options.route.map(\.isGames) == true ? .games : screens.isEmpty ? .home : .explore),
            unreadCount: options.unread ?? 0, reader: options.reader, explorePath: screens, gamesPath: options.gamesPath,
            mePath: options.mePath, game: options.game
        )
        appModel.autoplay = options.autoplay
        let stats = options.today.map { today in GameStats(now: { today.noon }) } ?? GameStats()
        #else
        let appModel = AppModel()
        let stats = GameStats()
        #endif
        _model = State(initialValue: appModel)
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
        #if DEBUG
        if options.seedDivan { marks.seedDivan() }
        let feedbackOptions = FeedbackLaunchOptions.fromProcess
        feedbackOpen = feedbackOptions.open
        let feedback = feedbackOptions.makeCenter(app: appModel, text: textSettings, session: accounts.session)
        #else
        let feedback = FeedbackCenter(app: appModel, text: textSettings, session: accounts.session)
        #endif
        feedback.presenter = FeedbackSheetPresenter()
        _feedback = State(initialValue: feedback)
        #if DEBUG
        let center = MessagesCenter(session: accounts.session, sockets: MessagesLaunchOptions.fromProcess.sockets)
        MessagesLaunchOptions.fromProcess.prepare(center: center, app: appModel)
        #else
        let center = MessagesCenter(session: accounts.session)
        #endif
        center.onUnread = { appModel.unreadCount = $0 }
        center.show = { appModel.showChat($0) }
        _messages = State(initialValue: center)
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
                .environment(feedback)
                .environment(messages)
                .environment(resolver)
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
                .onReceive(NotificationCenter.default.publisher(for: .deviceDidShake)) { _ in
                    if !accounts.onboarding.isRunning { feedback.shake() }
                }
                .task {
                    await accounts.session.restore()
                    await accounts.pictures.refreshIfNeeded()
                }
                #if DEBUG
                .task {
                    if let feedbackOpen { await feedback.debugOpen(feedbackOpen) }
                }
                #endif
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
