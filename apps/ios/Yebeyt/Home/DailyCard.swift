import SwiftUI

/// The card of «بیتِ امروز» as drawn on the Calm board: the couplet, the poet, پسند / بازنشر / بفرست, and
/// «رد کن» next to «نگه دار».
struct DailyCard: View {
    @Environment(ReaderMarks.self) private var marks
    @Environment(AccountModel.self) private var account
    let pick: HomeModel.Pick
    let open: () -> Void
    let send: () -> Void
    let reject: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Button(action: open) {
                VStack(spacing: 12) {
                    VStack(spacing: 0) {
                        line(pick.couplet.m1)
                        if !pick.couplet.m2.isEmpty { line(pick.couplet.m2) }
                    }
                    Text(pick.poet).font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(pick.couplet.m1) \(pick.couplet.m2) \(pick.poet)")
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier("dailyCouplet")
            actions
            buttons
        }
        .padding(EdgeInsets(top: 22, leading: 18, bottom: 14, trailing: 18))
        .background {
            RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 11, x: 0, y: 6)
        }
    }

    /// One hemistich: Parastoo Bold 20 on a 42-unit line (line-height 2.1).
    private func line(_ text: String) -> some View {
        Text(text)
            .font(.poem(20))
            .foregroundStyle(Tokens.Colors.ink)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 42)
    }

    private var actions: some View {
        let liked = marks.contains(.liked, poemPath: pick.path, couplet: pick.index)
        let reposted = marks.contains(.reposted, poemPath: pick.path, couplet: pick.index)
        return HStack(spacing: 18) {
            iconButton("پسند", on: liked) {
                account.require(.likes, needed: !liked) { marks.toggle(.liked, poemPath: pick.path, couplet: pick.index) }
            } icon: {
                LineIcon(shape: HeartIcon(), size: 22, lineWidth: 2.2, fill: liked ? Tokens.Colors.magenta : nil)
                    .foregroundStyle(liked ? Tokens.Colors.magenta : Tokens.Colors.ink)
            }
            iconButton("بازنشر", on: reposted) {
                account.require(.likes, needed: !reposted) { marks.toggle(.reposted, poemPath: pick.path, couplet: pick.index) }
            } icon: {
                LineIcon(shape: RepostIcon(), size: 22, lineWidth: 2.2, fill: nil)
                    .foregroundStyle(reposted ? Tokens.Colors.lapis : Tokens.Colors.ink)
            }
            iconButton("بفرست", on: false, action: send) {
                LineIcon(shape: MessagesIcon(), size: 22, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.ink)
            }
        }
    }

    private func iconButton(_ label: String, on: Bool, action: @escaping () -> Void, @ViewBuilder icon: () -> some View) -> some View {
        Button(action: action) {
            icon().markMotion(on: on).padding(4).contentShape(Rectangle())
        }
        .buttonStyle(.press)
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var buttons: some View {
        let kept = marks.contains(.kept, poemPath: pick.path, couplet: pick.index)
        return HStack(spacing: 10) {
            Button(action: reject) {
                HStack(spacing: 6) {
                    LineIcon(shape: CloseIcon(), size: 18, lineWidth: 2.6, fill: nil)
                    Text("رد کن").font(.ui(15, weight: .bold))
                }
                .foregroundStyle(Tokens.Colors.ink)
                .frame(maxWidth: .infinity, minHeight: 48, maxHeight: 48)
                .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.paper))
            }
            .buttonStyle(.press)
            .accessibilityIdentifier("reject")
            Button {
                marks.toggle(.kept, poemPath: pick.path, couplet: pick.index)
            } label: {
                HStack(spacing: 6) {
                    LineIcon(shape: BookmarkIcon(), size: 18, lineWidth: 2.4, fill: kept ? Tokens.Colors.white : nil).markMotion(on: kept)
                    Text("نگه دار").font(.ui(15, weight: .bold))
                }
                .foregroundStyle(Tokens.Colors.white)
                .frame(maxWidth: .infinity, minHeight: 42, maxHeight: 42)
                .sticker(fill: Tokens.Colors.lapis, radius: 16, border: 3, shadow: ShadowToken(y: 2, blur: 8, opacity: 0.22))
            }
            .buttonStyle(.press)
            .accessibilityAddTraits(kept ? .isSelected : [])
            .accessibilityIdentifier("keep")
        }
    }
}
