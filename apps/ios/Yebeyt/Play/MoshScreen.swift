import SwiftUI

/// PlayMosh: the scores and the time left, the couplets played so far, and — on my turn — the input with the letter to
/// start with and the couplets of the divan and the books that fit. Live events and the clock keep it up to date.
struct MoshScreen: View {
    let gameID: String
    @Environment(AppModel.self) private var app
    @Environment(FriendGames.self) private var games
    @Environment(Library.self) private var library
    @State private var now = Date.now
    @State private var lastOverdueRead = Date.distantPast
    @State private var toast: String?

    private var state: MoshState? {
        guard let me = games.me, let game = games.game(gameID) else { return nil }
        return MoshState(game: game, me: me)
    }

    var body: some View {
        VStack(spacing: 14) {
            if let state {
                header(state)
                titleRow(state)
                if state.isWaiting { waiting(state) } else { MoshMoves(state: state) }
                if state.isDone { MoshEnd(state: state) } else if state.isActive { MoshPanel(state: state, toast: $toast) }
            } else {
                GameLoadingView()
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .dottedPaper()
        .toast($toast)
        .task { await games.load(gameID) }
        .task { await keepTime() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mosh")
    }

    /// The clock of the header runs every second; when a turn has run out the server is asked, as it ends the game then.
    private func keepTime() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1))
            now = .now
            guard let state, state.secondsLeft(now: now) == 0, now.timeIntervalSince(lastOverdueRead) > 4 else { continue }
            lastOverdueRead = now
            await games.load(gameID)
        }
    }

    // MARK: Header

    private func header(_ state: MoshState) -> some View {
        HStack(spacing: 10) {
            GameCloseButton { app.closeGame() }
            HStack(spacing: 10) {
                Face(parts: state.mine?.avatar, size: 34, border: 2)
                Text(PersianDigits.string(state.myScore)).font(.title(20)).padding(.top, 3).accessibilityIdentifier("moshMyScore")
                Text("در برابر").font(.ui(11)).foregroundStyle(Color(hex: 0x8A8698))
                Text(PersianDigits.string(state.theirScore)).font(.title(20)).padding(.top, 3).accessibilityIdentifier("moshTheirScore")
                Face(parts: state.other?.avatar, size: 34, border: 2)
            }
            .foregroundStyle(Tokens.Colors.ink)
            .padding(.horizontal, 12).padding(.vertical, 4)
            .frame(maxWidth: .infinity)
            .background(Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 4, x: 0, y: 2))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("تو \(PersianDigits.string(state.myScore)) در برابر \(state.other?.name ?? "") \(PersianDigits.string(state.theirScore))")
            if let time = state.timeLabel(now: now) {
                HStack(spacing: 4) {
                    LineIcon(shape: SVGShape(d: "M4 13a8 8 0 1 0 16 0a8 8 0 1 0-16 0zM12 9v4l2.5 2M9.5 2.5h4"), size: 15, lineWidth: 2.4, fill: nil)
                    Text(time).font(.ui(13, weight: .bold))
                }
                .foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 11).padding(.vertical, 6)
                .background(Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.14), radius: 4, x: 0, y: 2))
                .accessibilityLabel("زمان باقی‌مونده")
                .accessibilityValue(time)
                .accessibilityIdentifier("moshTime")
            }
        }
    }

    private func titleRow(_ state: MoshState) -> some View {
        HStack(spacing: 10) {
            GameIcon(kind: .mosh, size: 44)
            Text(state.other.map { "مشاعره با \($0.name)" } ?? "مشاعره")
                .font(.title(26)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3).accessibilityAddTraits(.isHeader)
            Text(state.roundLine).font(.ui(12)).foregroundStyle(Tokens.Colors.muted).accessibilityIdentifier("moshRound")
            Spacer(minLength: 0)
        }
    }

    /// Nobody has joined yet: the link and the waiting line.
    private func waiting(_ state: MoshState) -> some View {
        VStack(spacing: 8) {
            Spacer()
            Text(PlayCopy.waiting(for: "")).font(.title(24)).foregroundStyle(Tokens.Colors.ink)
            Text(PlayCopy.gameLink(state.game.code)).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                .environment(\.layoutDirection, .leftToRight)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moshWaiting")
    }
}

/// The couplets played, mine at the end (physical left) in lapis and the other's at the start in white, each with its
/// poet; the last one has its last letter marked.
struct MoshMoves: View {
    let state: MoshState
    @Environment(Library.self) private var library

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(state.game.moves) { move in
                        bubble(move, last: move.n == state.lastMove?.n).id(move.n)
                    }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
            .defaultScrollAnchor(.bottom)
            .onChange(of: state.game.moves.count) { _, _ in withAnimation(.snappy) { proxy.scrollTo("end", anchor: .bottom) } }
            .mask {
                VStack(spacing: 0) {
                    LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom).frame(height: 40)
                    Rectangle()
                }
            }
        }
    }

    private func bubble(_ move: MoshMove, last: Bool) -> some View {
        let mine = move.username == state.me
        let poet = CoupletKey.parse(move.key).flatMap { library.poet(slug: String($0.path.dropFirst().prefix { $0 != "/" }))?.name } ?? ""
        let who = mine ? "تو" : state.other?.name ?? ""
        return VStack(alignment: mine ? .trailing : .leading, spacing: 4) {
            Text(poet.isEmpty ? who : "\(who) · \(poet)").font(.ui(11)).foregroundStyle(Tokens.Colors.muted)
            VStack(alignment: .leading, spacing: 2) {
                Text(TextNormalizer.plain(move.m1))
                Text(MoshLastLetter.marked(TextNormalizer.plain(move.m2), highlight: last))
            }
            .font(.poem(15.5)).lineSpacing(5)
            .foregroundStyle(mine ? Tokens.Colors.white : Tokens.Colors.ink)
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background {
                UnevenRoundedRectangle(
                    topLeadingRadius: mine ? 6 : 22, bottomLeadingRadius: 22, bottomTrailingRadius: 22, topTrailingRadius: mine ? 22 : 6
                )
                .fill(mine ? Tokens.Colors.lapis : Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.10), radius: 4, x: 0, y: 2)
            }
        }
        .frame(maxWidth: 297, alignment: mine ? .trailing : .leading)
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("moshMove-\(move.n)")
    }
}

/// The couplet's second hemistich with its last letter marked: amber on the other's white bubble, lapis on the card in the chat.
enum MoshLastLetter {
    /// The board's chip is the letter with 4 to 5pt of room on both sides. Text can't pad a background, and a space before
    /// the letter would cut its joining with the letter before it, so the room is a thin space after it (the end of the line).
    static func marked(_ text: String, highlight: Bool, background: Color = Tokens.Colors.amber, foreground: Color = Tokens.Colors.ink) -> AttributedString {
        guard highlight, let range = MoshLetters.lastLetterRange(in: text) else { return AttributedString(text) }
        let start = text.distance(from: text.startIndex, to: range.lowerBound), end = text.distance(from: text.startIndex, to: range.upperBound)
        let padded = String(text[..<range.upperBound]) + "\u{2009}" + String(text[range.upperBound...])
        var result = AttributedString(padded)
        let from = padded.index(padded.startIndex, offsetBy: start), to = padded.index(padded.startIndex, offsetBy: end + 1)
        guard let marked = Range(from..<to, in: result) else { return result }
        result[marked].backgroundColor = background
        result[marked].foregroundColor = foreground
        return result
    }
}

/// The end of a game: the result, why, and the way out.
struct MoshEnd: View {
    let state: MoshState
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 8) {
            Text(state.outcomeTitle ?? "").font(.title(34)).foregroundStyle(Tokens.Colors.ink).accessibilityIdentifier("moshOutcome")
            if let line = state.endLine { Text(line).font(.ui(14)).foregroundStyle(Tokens.Colors.muted).accessibilityIdentifier("moshEndLine") }
            Text(PlayCopy.scores(mine: state.myScore, name: state.other?.name ?? "", theirs: state.theirScore))
                .font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
            Button("برگشت") { app.closeGame() }
                .buttonStyle(GameBigButtonStyle(height: 56, border: 4, fontSize: 21))
                .padding(.top, 8)
                .accessibilityIdentifier("moshBack")
        }
        .padding(EdgeInsets(top: 18, leading: 18, bottom: 26, trailing: 18))
        .frame(maxWidth: .infinity)
        .background(UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26).fill(Tokens.Colors.white.opacity(0.7)))
        .padding(.horizontal, -18)
    }
}
