import SwiftUI
import UIKit

/// دوستاتو بیار: the invite text (a tone preset, or written by hand), the personal link, and the ways to send it.
/// It needs an account (the link has the username), so the gate comes before this screen.
struct InviteScreen: View {
    @Environment(Session.self) private var session
    @State private var tone: InviteTone? = .friendly
    @State private var text = InviteTone.friendly.body
    @State private var writing = false
    @State private var toast: String?
    @State private var toastTask: Task<Void, Never>?
    @FocusState private var editing: Bool

    private var username: String? { session.user?.username }
    private var link: String { username.map(InviteLink.display(username:)) ?? "yebeyt.com" }
    private var message: String { InviteMessage.text(body: text, link: link) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                hero
                textCard
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader { HStack(spacing: 12) {
            BackButton()
            Text("دوستاتو بیار").font(.title(28)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
        } }
        .dismissesKeyboard()
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .bottom) { toastView }
        .animation(Motion.bouncy, value: toast)
        .task { await session.restore() }
    }

    // MARK: Hero

    private var hero: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("شعر با رفیق\nقشنگ‌تره").font(.title(26)).lineSpacing(-4)
            }
            .foregroundStyle(Tokens.Colors.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 6) {
                miniCard(fill: Tokens.Colors.white, bar: Tokens.Colors.lapis, tilt: 0)
                miniCard(fill: Tokens.Colors.fire, bar: Tokens.Colors.white, tilt: 10)
            }
            .tilted(-8)
        }
        .padding(18)
        .background(RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.lapis).shadow(color: Tokens.Colors.lapis.opacity(0.25), radius: 8, x: 0, y: 6))
        .accessibilityElement(children: .combine)
    }

    private func miniCard(fill: Color, bar: Color, tilt: Double) -> some View {
        RoundedRectangle(cornerRadius: 3).fill(bar).frame(width: 18, height: 5)
            .frame(width: 34, height: 50)
            .background(RoundedRectangle(cornerRadius: 9).fill(fill).stickerShadow(ShadowToken(y: 3, blur: 8, opacity: 0.2)))
            .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(Tokens.Colors.white, lineWidth: 4))
            .tilted(tilt)
    }

    // MARK: Text and ways to send

    private var textCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("متن دعوت").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                Spacer()
                Button {
                    writing.toggle()
                    tone = nil
                    editing = writing
                } label: {
                    HStack(spacing: 4) {
                        LineIcon(shape: WriteIcon(), size: 14, lineWidth: 2.4, fill: nil)
                        Text("خودم بنویسم").font(.ui(12, weight: .bold))
                    }
                    .foregroundStyle(Tokens.Colors.lapis)
                }
                .accessibilityIdentifier("inviteWrite")
            }
            SegmentedControl(
                options: InviteTone.allCases.map { ($0 as InviteTone?, $0.title) }, selection: Binding(get: { tone }, set: { choose($0) }),
                style: .tone, label: "لحن", idPrefix: "tone"
            )
            preview
            shareRow
        }
        .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
        .meCard(radius: 24, shadow: 0.08)
    }

    private func choose(_ new: InviteTone?) {
        guard let new else { return }
        tone = new
        text = new.body
        writing = false
        editing = false
    }

    private var preview: some View {
        VStack(alignment: .leading, spacing: 0) {
            if writing {
                TextField("", text: $text, axis: .vertical)
                    .focused($editing)
                    .font(.ui(14)).lineSpacing(6)
                    .foregroundStyle(Tokens.Colors.ink)
                    .accessibilityIdentifier("inviteText")
            } else {
                Text(text).font(.ui(14)).lineSpacing(6).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityIdentifier("inviteBody")
            }
            Text("«\(InviteMessage.opener)»").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                .padding(.top, 2)
            Text(link).font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                .environment(\.layoutDirection, .leftToRight)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .accessibilityIdentifier("inviteLink")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14))
        .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.boardPaper))
    }

    private var shareRow: some View {
        ShareRow(
            style: .labelled,
            prepare: { SharePayload(text: message, url: username.map(InviteLink.url(username:)) ?? "https://yebeyt.com") },
            story: { _ in InviteStoryCard.image(link: link) },
            copied: { showToast("کپی شد") }
        )
        .disabled(username == nil)
        .opacity(username == nil ? 0.5 : 1)
    }

    private func showToast(_ line: String) {
        toast = line
        toastTask?.cancel()
        toastTask = Task {
            try? await Task.sleep(for: .seconds(2))
            if !Task.isCancelled { toast = nil }
        }
    }

    @ViewBuilder private var toastView: some View {
        if let toast {
            Text(toast).font(.ui(13, weight: .medium)).foregroundStyle(Tokens.Colors.white)
                .padding(.horizontal, 16).padding(.vertical, 9)
                .background(Capsule().fill(Tokens.Colors.ink))
                .padding(.bottom, 24)
                .toastTransition()
                .accessibilityIdentifier("toast")
        }
    }
}
