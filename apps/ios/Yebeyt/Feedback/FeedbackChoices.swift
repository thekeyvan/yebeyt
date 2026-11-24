import SwiftUI

/// What the feedback sheet shows: the five choices, then the form of the chosen type. It is hosted in a UIKit sheet, so
/// it sets the app's environment (right-to-left, the font, light) itself.
struct FeedbackSheetRoot: View {
    let center: FeedbackCenter

    var body: some View {
        Group {
            if let model = center.model {
                if model.type == .game {
                    FeedbackGameForm(center: center, model: model)
                } else {
                    FeedbackForm(center: center, model: model)
                }
            } else {
                FeedbackChoices(center: center)
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .environment(\.locale, Locale(identifier: "fa_IR"))
        .preferredColorScheme(.light)
        .font(.ui(16))
        .tint(Tokens.Colors.lapis)
        .interactiveDismissDisabled(center.model.map { $0.hasUnsentWork || $0.isLocked } ?? false)
        .sheet(isPresented: confirming) {
            ConfirmSheet(
                title: center.closeQuestion, message: nil, confirm: FeedbackCopy.discard, cancel: FeedbackCopy.stay,
                prefix: "feedbackDiscard", isPresented: confirming
            ) { await center.close() }
        }
    }

    private var confirming: Binding<Bool> {
        Binding(get: { center.isConfirmingClose }, set: { center.isConfirmingClose = $0 })
    }
}

/// FeedbackShake: «می‌خوای چیزی بگی؟» with the five types and the note about the settings.
struct FeedbackChoices: View {
    let center: FeedbackCenter

    private var lead: String {
        let rest = "هر چی تو ذهنته بگو، همه‌ش رو خودمون می‌خونیم."
        return center.snapshot?.fromShake == true ? "گوشی رو تکون دادی. " + rest : rest
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("می‌خوای چیزی بگی؟").font(.title(26)).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityAddTraits(.isHeader)
                Text(lead).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).lineSpacing(4)
            }
            .padding(.top, 6)
            VStack(spacing: 0) {
                ForEach(Array(FeedbackType.menuOrder.enumerated()), id: \.element) { index, type in
                    row(type)
                    if index < FeedbackType.menuOrder.count - 1 { Tokens.Colors.paper.frame(height: 1) }
                }
            }
            Text("تکون دادن برای بازخورد رو از تنظیمات می‌تونی خاموش کنی.")
                .font(.ui(11)).foregroundStyle(Color.feedbackHint)
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("feedbackShakeNote")
        }
        .padding(.horizontal, 20)
        .padding(.top, 26)
        .padding(.bottom, 8)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Tokens.Colors.white.ignoresSafeArea())
    }

    private func row(_ type: FeedbackType) -> some View {
        Button { center.choose(type) } label: {
            HStack(spacing: 12) {
                type.icon
                    .foregroundStyle(type.iconColor)
                    .frame(width: 42, height: 42)
                    .background(Circle().fill(type.tint))
                    .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .shadow(color: Tokens.Colors.ink.opacity(0.16), radius: 3, x: 0, y: 2)
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 4) {
                        Text(type.title).font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                        if type.isNew {
                            Text("تازه").font(.ui(11)).foregroundStyle(Tokens.Colors.lapis)
                                .padding(.horizontal, 8).padding(.vertical, 1)
                                .background(Capsule().fill(Tokens.Colors.lapisTint))
                        }
                    }
                    Text(type.subtitle).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                }
                Spacer(minLength: 0)
                LineIcon(shape: ChevronLeftIcon(), size: 16, lineWidth: 2.4, fill: nil).foregroundStyle(Color.feedbackHint)
            }
            .padding(.vertical, 9).padding(.horizontal, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("feedbackType-\(type.rawValue)")
    }
}
