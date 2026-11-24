import Foundation
import SwiftUI

/// Leaving a solo game before its round is over. The question is only for a round that has started, and the copy is the
/// lead's (docs/yebeyt-2.md, «Asking before it hurts»).
enum LeaveGame {
    static let title = "از بازی بری بیرون؟"
    static let message = "نتیجه‌ی این دور ثبت نمی‌شه."
    static let leave = "برو بیرون"
    static let stay = "بمون"

    /// The round has started when an answer is given or its clock runs; a round whose result screen shows has nothing
    /// left to lose.
    static func asks(answered: Int, clockRuns: Bool, finished: Bool) -> Bool {
        !finished && (answered > 0 || clockRuns)
    }
}

extension JigsawSession {
    /// The clock of a round runs from the first second.
    var asksBeforeLeaving: Bool { LeaveGame.asks(answered: round.answers.count, clockRuns: !round.isOver, finished: finished) }
}

extension QuizSession {
    /// حدس شاعر, مصراع دوم and از کدوم کتاب؟ are timed; گوش کن has no clock, so it waits for the first answer.
    var asksBeforeLeaving: Bool { LeaveGame.asks(answered: round.answers.count, clockRuns: round.clock != .none, finished: finished) }
}

extension MatchSession {
    /// معنی‌یاب has no clock: a pair is its first answer.
    var asksBeforeLeaving: Bool { LeaveGame.asks(answered: round.pairs, clockRuns: false, finished: finished) }
}

/// A game start that waits for «برو بیرون».
struct PendingGameStart: Identifiable {
    let id = UUID()
    let start: () -> Void
}

/// Shows «از بازی بری بیرون؟» for `AppModel.startGame`. One place at a time can present it: the tabs, or the reader when it is
/// open (`active` is false for the tabs then), as a sheet cannot open under a full-screen cover.
private struct LeaveGameQuestion: ViewModifier {
    @Bindable var app: AppModel
    let active: Bool

    func body(content: Content) -> some View {
        content
            .sheet(item: active ? $app.pendingGameStart : .constant(nil)) { pending in
                ConfirmSheet(
                    title: LeaveGame.title, message: LeaveGame.message, confirm: LeaveGame.leave, cancel: LeaveGame.stay,
                    prefix: "leaveGame", isPresented: Binding(get: { app.pendingGameStart != nil }, set: { if !$0 { app.pendingGameStart = nil } })
                ) { pending.start() }
            }
            .onChange(of: active && app.pendingGameStart != nil) { _, asking in if active { app.leaveQuestionOpen = asking } }
    }
}

extension View {
    func leaveGameQuestion(_ app: AppModel, active: Bool = true) -> some View {
        modifier(LeaveGameQuestion(app: app, active: active))
    }
}
