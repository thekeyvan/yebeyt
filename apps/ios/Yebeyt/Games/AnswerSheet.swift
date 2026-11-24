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
    /// A finished game or puzzle: the burst is bigger.
    var celebrates = false
    @State private var share: ReaderModel.Share?
    @State private var aiToastShown = false
    @State private var aiToastTask: Task<Void, Never>?

    /// The dimmed background and the sheet are two views of the screen's stack, so that each has its own transition
    /// (a transition inside one container is not used: the container fades as a whole).
    var body: some View {
        Group {
            Tokens.Colors.ink.opacity(0.18).ignoresSafeArea().accessibilityHidden(true)
                .transition(Motion.scrim)
            // Closing it is «بعدی»: a drag down does what the big button does. A tap on the background does not (it
            // would skip the verdict by accident), so the scrim takes no tap.
            sheet
                .dragToDismiss(next)
                .frame(maxHeight: .infinity, alignment: .bottom)
                .accessibilityElement(children: .contain)
                .accessibilityAddTraits(.isModal)
                .sheet(item: $share) { ShareSheet(text: $0.text).presentationDetents([.medium, .large]) }
                .motionTransition(Motion.sheet)
        }
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
        .overlay(alignment: .top) {
            if aiToastShown { AIToast().offset(y: -52).toastTransition() }
        }
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
            .verdictMotion(right: right, burst: celebrates ? .win : .right, style: celebrates ? .big : nil)
            .tilted(-8)
            VStack(alignment: .leading, spacing: 0) {
                Text(title ?? (right ? "درست چسبوندی!" : "این یکی نشد")).font(.title(26)).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityIdentifier("verdict")
                if let detail { Text(detail).font(.ui(13)).foregroundStyle(Tokens.Colors.muted) }
            }
            Spacer(minLength: 0)
        }
    }

    /// The sparkle was tapped: say where the meaning comes from, for a moment (a second tap starts the moment again).
    private func explainAI() {
        withAnimation(Motion.bouncy) { aiToastShown = true }
        aiToastTask?.cancel()
        aiToastTask = Task {
            try? await Task.sleep(for: .seconds(2.5))
            if !Task.isCancelled { withAnimation(.snappy) { aiToastShown = false } }
        }
    }

    private func meaningCard(_ meaning: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 2) {
                Text("یعنی چی؟").font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                if couplet.showsAIMark { AISparkleButton(action: explainAI) }
            }
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
            action("کل شعر", BookIcon(), mark: nil, id: "sheetPoem") { app.openReader(ReaderRoute(path: couplet.poem, couplet: couplet.index)) }
            action("نگه دار", BookmarkIcon(), mark: .keep, fill: kept, id: "sheetKeep") {
                marks.toggleKept(poemPath: couplet.poem, couplet: couplet.index) { app.showToast($0, undo: $1) }
            }
            action("بفرست", MessagesIcon(), mark: .send, id: "sheetSend") { share = ReaderModel.Share(text: couplet.share) }
        }
    }

    private func action(_ title: String, _ icon: some Shape, mark: Burst.Action?, fill: Bool = false, id: String, perform: @escaping () -> Void) -> some View {
        MarkButton(action: perform) { taps in
            VStack(spacing: 4) {
                LineIcon(shape: icon, size: 22, lineWidth: 2.2, fill: fill ? Tokens.Colors.ink : nil).markMotion(mark, on: fill, taps: taps)
                Text(title).font(.ui(13, weight: .medium))
            }
            .foregroundStyle(Tokens.Colors.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.boardPaper))
        }
        .buttonStyle(.press)
        .accessibilityIdentifier(id)
    }
}
