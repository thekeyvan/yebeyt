import SwiftUI

/// FeedbackGame: a game idea with its name (optional), how it plays and who plays it. No screenshot.
struct FeedbackGameForm: View {
    let center: FeedbackCenter
    @Bindable var model: FeedbackModel
    @FocusState private var nameFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                FeedbackHeader(title: "یه بازی پیشنهاد بده", canSend: model.canSend, close: { Task { await center.requestClose() } }, send: { Task { await center.send() } })
                VStack(alignment: .leading, spacing: 7) {
                    FeedbackLabel(title: "اسمش", hint: "اگه داره")
                    TextField("", text: $model.draft.gameName, prompt: Text("مثلاً «بیت عوضی»").foregroundStyle(Color.feedbackHint))
                        .font(.ui(14))
                        .foregroundStyle(Tokens.Colors.ink)
                        .focused($nameFocused)
                        .disabled(model.isLocked)
                        .padding(.horizontal, 14)
                        .frame(height: 46)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.white))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Tokens.Colors.lapis, lineWidth: nameFocused ? 2 : 0))
                        .onChange(of: model.draft.gameName) { _, new in
                            if new.count > FeedbackDraft.nameLimit { model.draft.gameName = String(new.prefix(FeedbackDraft.nameLimit)) }
                        }
                        .accessibilityIdentifier("feedbackGameName")
                }
                VStack(alignment: .leading, spacing: 7) {
                    FeedbackLabel(title: "چطوری بازی می‌شه؟")
                    FeedbackTextArea(text: $model.draft.text, minHeight: 118, label: "چطوری بازی می‌شه؟", id: "feedbackText", disabled: model.isLocked)
                }
                VStack(alignment: .leading, spacing: 7) {
                    FeedbackLabel(title: "با کی بازی می‌شه؟")
                    SegmentedControl(
                        options: FeedbackPlayers.allCases.map { ($0, $0.title) }, selection: $model.draft.players,
                        style: .feedback(vertical: 8), label: "با کی بازی می‌شه؟", idPrefix: "feedbackPlayers"
                    )
                    .disabled(model.isLocked)
                }
                if let failure = model.failure { FeedbackFailureLine(line: failure) }
                Text("بدون حساب هم می‌شه فرستاد. اگه وارد شده باشی، نام کاربریت هم میاد تا بتونیم جوابت رو بدیم.")
                    .font(.ui(12)).foregroundStyle(Color.feedbackHint).lineSpacing(4)
                    .padding(.horizontal, 4)
                    .accessibilityIdentifier("feedbackAccountNote")
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .background(Tokens.Colors.boardPaper.ignoresSafeArea())
    }
}
