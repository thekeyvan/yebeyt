import SwiftUI

/// ChallengeSend, for جورچین: the points, «n از ۱۰», and — until challenges and links exist — the round's
/// couplets as rows that open the reader.
struct RoundEndScreen: View {
    @Environment(AppModel.self) private var app
    let session: JigsawSession

    private var round: JigsawRound { session.round }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                topBar
                summary
                couplets
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .accessibilityIdentifier("roundEnd")
    }

    private var topBar: some View {
        HStack {
            RoundButton(label: "برگشت", action: { app.closeGame() }) {
                LineIcon(shape: ChevronRightIcon(), size: 20, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.ink)
            }
            .accessibilityIdentifier("roundEndBack")
            Spacer()
            Text("+\(PersianDigits.string(round.totalPoints)) امتیاز")
                .font(.title(16)).foregroundStyle(Tokens.Colors.ink)
                .padding(EdgeInsets(top: 4, leading: 12, bottom: 0, trailing: 12))
                .padding(.bottom, 2)
                .sticker(fill: Tokens.Colors.amber, radius: Tokens.Sticker.Radius.pill, border: 3, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.18))
                .accessibilityIdentifier("roundEndPoints")
        }
    }

    private var summary: some View {
        HStack(spacing: 16) {
            VStack(spacing: 0) {
                Text(PersianDigits.string(round.rightCount)).font(.title(40)).frame(height: 40).padding(.top, 6)
                Text("از \(PersianDigits.string(round.questions.count))").font(.ui(12, weight: .bold))
            }
            .foregroundStyle(Tokens.Colors.white)
            .frame(width: 86, height: 86)
            .sticker(fill: Tokens.Colors.lapis, radius: 48, border: 5, shadow: ShadowToken(y: 6, blur: 16, opacity: 0.3))
            .tilted(-6)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("roundEndScore")
            VStack(alignment: .leading, spacing: 4) {
                Text("تموم شد!").font(.title(28)).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityAddTraits(.isHeader)
                Text(subtitle).font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4).padding(.top, 4)
    }

    /// «جورچین بیت · ۱۰ بیت سعدی · ۱:۴۲»
    private var subtitle: String {
        let seconds = round.elapsed
        let time = "\(PersianDigits.string(seconds / 60)):\(PersianDigits.string(seconds % 60 / 10))\(PersianDigits.string(seconds % 10))"
        let count = "\(PersianDigits.string(round.questions.count)) بیت" + (round.singlePoet.map { " \($0)" } ?? "")
        return "جورچین بیت · \(count) · \(time)"
    }

    private var couplets: some View {
        VStack(spacing: 8) {
            ForEach(Array(round.questions.enumerated()), id: \.offset) { index, question in
                row(question.couplet, result: index < round.answers.count ? round.answers[index].result.isRight : nil)
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
