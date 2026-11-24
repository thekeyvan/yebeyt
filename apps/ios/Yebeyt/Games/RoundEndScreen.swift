import SwiftUI

/// ChallengeSend, for every game: the points, «n از ۱۰», and then the challenge card (جورچین and حدس شاعر, for a signed-in
/// person), a card of the caller's (the result of a challenge), or the round's couplets as rows that open the reader.
struct RoundEndScreen<Card: View>: View {
    @Environment(AppModel.self) private var app
    @Environment(Session.self) private var session
    @Environment(GameDeck.self) private var deck
    let summary: RoundSummary
    let card: Card
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var counted = false

    init(summary: RoundSummary, @ViewBuilder card: () -> Card) {
        self.summary = summary
        self.card = card()
    }

    private var offer: ChallengeOffer? { session.isSignedIn ? summary.offer.flatMap { $0.isInDeck(deck) ? $0 : nil } : nil }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                topBar
                scoreRow
                if let offer {
                    ChallengeSendCard(offer: offer)
                } else {
                    card
                    if summary.showsCouplets { couplets }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .accessibilityIdentifier("roundEnd")
        .task {
            withAnimation(Motion.countUp(Motion.variant(reduceMotion: reduceMotion))) { counted = true }
        }
    }

    private var topBar: some View {
        HStack {
            RoundButton(label: "برگشت", action: { app.closeGame() }) {
                LineIcon(shape: ChevronRightIcon(), size: 20, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.ink)
            }
            .accessibilityIdentifier("roundEndBack")
            Spacer()
            if summary.showsPoints {
                CountUp(value: counted ? Double(summary.points) : 0, prefix: "+", suffix: " امتیاز")
                    .font(.title(16)).foregroundStyle(Tokens.Colors.ink)
                    .padding(EdgeInsets(top: 4, leading: 12, bottom: 0, trailing: 12))
                    .padding(.bottom, 2)
                    .sticker(fill: Tokens.Colors.amber, radius: Tokens.Sticker.Radius.pill, border: 3, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.18))
                    .accessibilityLabel("+\(PersianDigits.string(summary.points)) امتیاز")
                    .accessibilityIdentifier("roundEndPoints")
            }
        }
    }

    private var scoreRow: some View {
        HStack(spacing: 16) {
            VStack(spacing: 0) {
                CountUp(value: counted ? Double(summary.right) : 0).font(.title(40)).frame(height: 40).padding(.top, 6)
                Text("از \(PersianDigits.string(summary.total))").font(.ui(12, weight: .bold))
            }
            .foregroundStyle(Tokens.Colors.white)
            .frame(width: 86, height: 86)
            .sticker(fill: Tokens.Colors.lapis, radius: 48, border: 5, shadow: ShadowToken(y: 6, blur: 16, opacity: 0.3))
            .celebrateOnAppear(summary.celebrates)
            .tilted(-6)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(PersianDigits.string(summary.right)) از \(PersianDigits.string(summary.total))")
            .accessibilityIdentifier("roundEndScore")
            VStack(alignment: .leading, spacing: 4) {
                Text(summary.title).font(.title(28)).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("roundEndTitle")
                Text(summary.subtitle).font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4).padding(.top, 4)
    }

    private var couplets: some View {
        VStack(spacing: 8) {
            ForEach(Array(summary.rows.enumerated()), id: \.offset) { _, item in
                row(item.couplet, result: item.result)
            }
        }
    }

    private func row(_ couplet: GameCouplet, result: Bool?) -> some View {
        Button { app.openReader(ReaderRoute(path: couplet.poem, couplet: couplet.index)) } label: {
            HStack(spacing: 12) {
                mark(result)
                VStack(alignment: .leading, spacing: 0) {
                    Text(TextNormalizer.plain(couplet.m1)).font(.poem(16))
                    Text(TextNormalizer.plain(couplet.m2)).font(.poem(16))
                    Text(couplet.source).font(.ui(11)).foregroundStyle(Color(hex: 0x8A8698)).padding(.top, 4)
                    if summary.showsMeanings, let meaning = couplet.meaning {
                        Text(meaning).font(.ui(12)).foregroundStyle(Tokens.Colors.muted).padding(.top, 2).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .foregroundStyle(Tokens.Colors.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(EdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14))
            .listCard()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("roundCouplet-\(couplet.id)")
    }

    /// Green ✓ for a right couplet, red × for a wrong one, a grey dot for one the time ran out before.
    @ViewBuilder private func mark(_ result: Bool?) -> some View {
        switch result {
        case true?:
            LineIcon(shape: CheckIcon(), size: 16, lineWidth: 3, fill: nil).foregroundStyle(Tokens.Colors.ink)
                .frame(width: 28, height: 28).background(Circle().fill(Tokens.Colors.green))
                .accessibilityLabel("درست")
        case false?:
            LineIcon(shape: CloseIcon(), size: 12, lineWidth: 3.2, fill: nil).foregroundStyle(Tokens.Colors.white)
                .frame(width: 28, height: 28).background(Circle().fill(Tokens.Colors.fire))
                .accessibilityLabel("نشد")
        case nil:
            Circle().fill(Tokens.Colors.trackLight).frame(width: 14, height: 14).frame(width: 28, height: 28)
                .accessibilityLabel("نرسیدی")
        }
    }
}

extension RoundEndScreen where Card == EmptyView {
    init(summary: RoundSummary) {
        self.init(summary: summary) { EmptyView() }
    }
}
