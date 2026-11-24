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
    @State private var feed: FeedModel

    init(session: Session) {
        _feed = State(initialValue: FeedModel(session: session))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeading(title: "دوستات", link: "پیدا کردن دوست", destination: .people)
                .padding(.top, 4)
            ForEach(feed.entries) { entry in
                FeedCard(item: entry.item)
                    .onAppear { if entry.id == feed.entries.last?.id { Task { await feed.loadMore() } } }
            }
        }
        .task { await feed.refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await feed.refresh() } }
        }
    }
}

/// One thing a friend did: their face, «کیان یه بیت به اشتراک گذاشت» over how long ago, and the couplet (tap to read it),
/// or the day's puzzle they solved with «تو هم».
private struct FeedCard: View {
    @Environment(AppModel.self) private var app
    let item: FeedItem

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            if let key = item.key { CoupletBox(key: key) }
        }
        .padding(EdgeInsets(top: 12, leading: 14, bottom: item.key == nil ? 12 : 14, trailing: 14))
        .background {
            RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3)
        }
        .contentShape(Rectangle())
        .onTapGesture { if let key = item.key, let route = FeedText.coupletRoute(of: key) { app.openReader(route) } }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("feedItem")
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
            if item.type == .daily {
                Button { app.play(.daily) } label: {
                    Text("تو هم").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                }
                .accessibilityIdentifier("feedJoinDaily")
            }
        }
    }
}

/// The couplet of a like or a repost, on the board's soft box with the poet under it. It loads from the poem; until then
/// (or when the poem can't be loaded) only the line above it shows.
private struct CoupletBox: View {
    @Environment(PoetryStore.self) private var poetry
    @Environment(Library.self) private var library
    let key: String
    @State private var couplet: Couplet?

    var body: some View {
        Group {
            if let couplet {
                VStack(spacing: 0) {
                    Text(couplet.m1).font(.poem(18))
                    if !couplet.m2.isEmpty { Text(couplet.m2).font(.poem(18)) }
                    Text(poetName).font(.ui(12)).foregroundStyle(Tokens.Colors.muted).padding(.top, 2)
                }
                .foregroundStyle(Tokens.Colors.ink)
                .multilineTextAlignment(.center)
                .lineSpacing(6)
                .frame(maxWidth: .infinity)
                .padding(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
                .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.boardPaper))
            }
        }
        .task(id: key) {
            guard let route = FeedText.coupletRoute(of: key), let poem = try? await poetry.poem(path: route.path), poem.couplets.indices.contains(route.couplet) else { return }
            couplet = poem.couplets[route.couplet]
        }
    }

    private var poetName: String {
        let slug = FeedText.coupletRoute(of: key)?.path.split(separator: "/").first.map(String.init) ?? ""
        return library.poet(slug: slug)?.name ?? ""
    }
}
