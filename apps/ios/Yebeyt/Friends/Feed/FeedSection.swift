import SwiftUI

/// «دوستات» on the home tab (Calm): the heading with «پیدا کردن دوست», then what friends did, newest first. A guest sees nothing.
struct FriendsFeedSection: View {
    @Environment(Session.self) private var session

    var body: some View {
        if session.isSignedIn { FeedSectionBody(session: session) }
    }
}

private struct FeedSectionBody: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(BlockedPeople.self) private var blocked
    @State private var feed: FeedModel

    init(session: Session) {
        _feed = State(initialValue: FeedModel(session: session))
    }

    var body: some View {
        // Lazy, so the next page is asked for only when the last card scrolls into view.
        LazyVStack(alignment: .leading, spacing: 10) {
            SectionHeading(title: "دوستات", link: "پیدا کردن دوست", destination: .people)
                .padding(.top, 4)
            let visible = blocked.visible(feed.entries)
            ForEach(visible) { entry in
                FeedCard(item: entry.item, counts: entry.item.key.flatMap { feed.counts[$0] })
                    .onAppear { if entry.id == visible.last?.id { Task { await feed.loadMore(hiding: blocked) } } }
            }
        }
        // Someone at the end of what was loaded was blocked: no row at the end will come into view, so ask for more.
        .onChange(of: blocked.usernames) {
            if let last = feed.entries.last, blocked.visible([last]).isEmpty { Task { await feed.loadMore(hiding: blocked) } }
        }
        .task { await feed.refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await feed.refresh() } }
        }
    }
}

/// A couplet loaded for a card.
private struct ShownCouplet {
    var couplet: Couplet
    var poet: String
    var title: String
}

/// One thing a friend did: their face, «کیان یه بیت به اشتراک گذاشت» over how long ago, and for a couplet the couplet
/// (tap to read it) with ♥ and repost counts, send and keep; for the day's puzzle «تو هم» when it is today's.
private struct FeedCard: View {
    @Environment(AppModel.self) private var app
    @Environment(Library.self) private var library
    @Environment(PoetryStore.self) private var poetry
    @Environment(ReaderMarks.self) private var marks
    @Environment(AccountModel.self) private var account
    let item: FeedItem
    let counts: ReactionCounts?
    @State private var shown: ShownCouplet?

    private var route: ReaderRoute? { item.key.flatMap(FeedText.coupletRoute(of:)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            if let shown { couplet(shown) }
            if route != nil { actions }
        }
        .padding(EdgeInsets(top: 12, leading: 14, bottom: route == nil ? 12 : 6, trailing: 14))
        .background {
            RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("feedItem")
        .task(id: item.key) {
            guard let route, let poem = try? await poetry.poem(path: route.path), poem.couplets.indices.contains(route.couplet) else { return }
            let slug = route.path.split(separator: "/").first.map(String.init) ?? ""
            shown = ShownCouplet(couplet: poem.couplets[route.couplet], poet: library.poet(slug: slug)?.name ?? "", title: ReaderText.shortTitle(poem.title))
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            FaceCircle(parts: item.user.avatar, size: 36)
            VStack(alignment: .leading, spacing: 0) {
                (Text(item.user.name).font(.ui(14, weight: .bold)) + Text(" \(FeedText.action(item))").font(.ui(14)))
                    .foregroundStyle(Tokens.Colors.ink)
                    .accessibilityLabel(FeedText.headline(item))
                Text(FeedText.relativeTime(item.at)).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
            if FeedText.isTodaysDaily(item) {
                Button { app.play(.daily) } label: {
                    Text("تو هم").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                }
                .accessibilityIdentifier("feedJoinDaily")
            }
        }
    }

    /// The couplet on the board's soft box with the poet under it; tap to read it.
    private func couplet(_ shown: ShownCouplet) -> some View {
        Button { if let route { app.openReader(route) } } label: {
            VStack(spacing: 0) {
                Text(shown.couplet.m1).font(.poem(18))
                if !shown.couplet.m2.isEmpty { Text(shown.couplet.m2).font(.poem(18)) }
                Text(shown.poet).font(.ui(12)).foregroundStyle(Tokens.Colors.muted).padding(.top, 2)
            }
            .foregroundStyle(Tokens.Colors.ink)
            .multilineTextAlignment(.center)
            .lineSpacing(6)
            .frame(maxWidth: .infinity)
            .padding(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
            .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.boardPaper))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("feedCouplet")
    }

    // MARK: Actions

    /// ♥ and repost with their counts, send; keep at the other end.
    @ViewBuilder private var actions: some View {
        if let route {
            let liked = marks.contains(.liked, poemPath: route.path, couplet: route.couplet)
            let reposted = marks.contains(.reposted, poemPath: route.path, couplet: route.couplet)
            let kept = marks.contains(.kept, poemPath: route.path, couplet: route.couplet)
            HStack {
                HStack(spacing: 14) {
                    action("پسند این بیت", on: liked, count: counts.map { FeedModel.shown($0.likes, serverMine: $0.likedByMe, localMine: liked) }, color: liked ? Tokens.Colors.magenta : Tokens.Colors.ink, id: "feedLike") {
                        LineIcon(shape: HeartIcon(), size: 20, lineWidth: 2.2, fill: liked ? Tokens.Colors.magenta : nil)
                    } tap: {
                        account.require(.likes, needed: !liked) { marks.toggle(.liked, poemPath: route.path, couplet: route.couplet) }
                    }
                    action("بازنشر این بیت", on: reposted, count: counts.map { FeedModel.shown($0.reposts, serverMine: $0.repostedByMe, localMine: reposted) }, color: reposted ? Tokens.Colors.lapis : Tokens.Colors.ink, id: "feedRepost") {
                        LineIcon(shape: RepostIcon(), size: 20, lineWidth: 2.2, fill: nil)
                    } tap: {
                        account.require(.likes, needed: !reposted) { marks.toggle(.reposted, poemPath: route.path, couplet: route.couplet) }
                    }
                    action("بفرست این بیت", on: false, count: nil, color: Tokens.Colors.ink, id: "feedSend") {
                        LineIcon(shape: MessagesIcon(), size: 20, lineWidth: 2.2, fill: nil)
                    } tap: {
                        if let shown { app.share = ReaderModel.Share(text: ReaderText.shareText(shown.couplet, poet: shown.poet, title: shown.title)) }
                    }
                }
                Spacer(minLength: 0)
                action("نگه داشتن این بیت", on: kept, count: nil, color: Tokens.Colors.ink, id: "feedKeep") {
                    LineIcon(shape: BookmarkIcon(), size: 20, lineWidth: 2.2, fill: kept ? Tokens.Colors.ink : nil)
                } tap: {
                    marks.toggle(.kept, poemPath: route.path, couplet: route.couplet)
                }
            }
        }
    }

    /// An icon with its count, in `color` (magenta ♥ and lapis repost when on, as on the Calm board; ink otherwise).
    private func action(_ label: String, on: Bool, count: Int?, color: Color, id: String, @ViewBuilder icon: () -> some View, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: 4) {
                icon()
                if let count, count > 0 { Text(PersianDigits.string(count)).font(.ui(12, weight: .bold)) }
            }
            .foregroundStyle(color)
            .padding(4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier(id)
    }
}
