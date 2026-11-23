import SwiftUI

/// The sheet after every answer, right or wrong (JigsawResult): the verdict, the couplet's meaning, who said it
/// and in which book, «کل شعر / نگه دار / بفرست» and a big button. The couplet itself stays on the screen behind.
struct AnswerSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(ReaderMarks.self) private var marks
    let couplet: GameCouplet
    let right: Bool
    /// The title of the sheet; «درست چسبوندی!» / «این یکی نشد» when not given.
    var title: String?
    /// «+۱۲۰ · ۱۸ ثانیه»
    let detail: String?
    let buttonTitle: String
    let buttonIdentifier: String
    let next: () -> Void
    @State private var share: ReaderModel.Share?

    var body: some View {
        ZStack(alignment: .bottom) {
            Tokens.Colors.ink.opacity(0.18).ignoresSafeArea().accessibilityHidden(true)
            sheet
                .transition(.move(edge: .bottom))
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .sheet(item: $share) { ShareSheet(text: $0.text).presentationDetents([.medium, .large]) }
    }

    private var sheet: some View {
        VStack(spacing: 16) {
            Capsule().fill(Tokens.Colors.ring).frame(width: 40, height: 5)
            verdict
            if let meaning = couplet.meaning { meaningCard(meaning) }
            actions
            Button(buttonTitle, action: next)
                .buttonStyle(GameBigButtonStyle())
                .accessibilityIdentifier(buttonIdentifier)
        }
        .padding(EdgeInsets(top: 12, leading: 20, bottom: 30, trailing: 20))
        .frame(maxWidth: .infinity)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 30, topTrailingRadius: 30)
                .fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 12, x: 0, y: -6)
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private var verdict: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.22), radius: 4, x: 0, y: 3)
                Circle().fill(right ? Tokens.Colors.green : Tokens.Colors.fire).padding(4)
                if right {
                    LineIcon(shape: CheckIcon(), size: 22, lineWidth: 3, fill: nil).foregroundStyle(Tokens.Colors.ink)
                } else {
                    LineIcon(shape: CloseIcon(), size: 18, lineWidth: 3, fill: nil).foregroundStyle(Tokens.Colors.white)
                }
            }
            .frame(width: 46, height: 46)
            .tilted(-8)
            VStack(alignment: .leading, spacing: 0) {
                Text(title ?? (right ? "درست چسبوندی!" : "این یکی نشد")).font(.title(26)).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityIdentifier("verdict")
                if let detail { Text(detail).font(.ui(13)).foregroundStyle(Tokens.Colors.muted) }
            }
            Spacer(minLength: 0)
        }
    }

    private func meaningCard(_ meaning: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("یعنی چی؟").font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
            Text(meaning).font(.ui(15)).lineSpacing(5).foregroundStyle(Tokens.Colors.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(couplet.source).font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
        .background(RoundedRectangle(cornerRadius: 18).fill(Tokens.Colors.boardPaper))
    }

    private var actions: some View {
        let kept = marks.contains(.kept, poemPath: couplet.poem, couplet: couplet.index)
        return HStack(spacing: 10) {
            action("کل شعر", BookIcon(), id: "sheetPoem") { app.openReader(ReaderRoute(path: couplet.poem, couplet: couplet.index)) }
            action("نگه دار", BookmarkIcon(), fill: kept, id: "sheetKeep") {
                marks.toggle(.kept, poemPath: couplet.poem, couplet: couplet.index)
            }
            action("بفرست", MessagesIcon(), id: "sheetSend") { share = ReaderModel.Share(text: couplet.share) }
        }
    }

    private func action(_ title: String, _ icon: some Shape, fill: Bool = false, id: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            VStack(spacing: 4) {
                LineIcon(shape: icon, size: 22, lineWidth: 2.2, fill: fill ? Tokens.Colors.ink : nil)
                Text(title).font(.ui(13, weight: .medium))
            }
            .foregroundStyle(Tokens.Colors.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.boardPaper))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }
}
