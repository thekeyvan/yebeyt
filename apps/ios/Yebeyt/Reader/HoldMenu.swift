import SwiftUI
import UIKit

/// A long press on a couplet: the page blurs, the couplet is lifted on a tilted card, with a row of icons and a list.
struct HoldMenu: View {
    @Environment(TextSettingsStore.self) private var text
    @Environment(ReaderMarks.self) private var marks
    let model: ReaderModel
    let couplet: Int
    let dismiss: () -> Void
    let playWithCouplet: () -> Void

    var body: some View {
        ZStack(alignment: .top) {
            Tokens.Colors.ink.opacity(0.38)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(perform: dismiss)
                .accessibilityHidden(true)
            VStack(spacing: 12) {
                lifted
                icons
                list
            }
            .padding(.horizontal, 16)
            .padding(.top, 262)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("کارهای این بیت")
        }
    }

    /// The held couplet: bigger, tilted, with a long shadow, like a sticker in the hand.
    private var lifted: some View {
        let settings = text.settings
        return VStack(spacing: 0) {
            CoupletText(couplet: model.couplets[couplet], settings: settings, size: settings.listSize, factor: settings.listFactor, color: Tokens.Colors.ink)
            Text(model.caption(for: couplet))
                .font(.ui(12))
                .foregroundStyle(Tokens.Colors.muted)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.top, 4)
        }
        .padding(EdgeInsets(top: 18, leading: 20, bottom: 18, trailing: 20))
        .background {
            RoundedRectangle(cornerRadius: 24)
                .fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.32), radius: 18, x: 0, y: 18)
        }
        .scaleEffect(1.03)
        .tilted(-1.5)
    }

    private var icons: some View {
        HStack {
            let liked = marks.contains(.liked, poemPath: model.path, couplet: couplet)
            round("پسند", on: liked) {
                LineIcon(shape: HeartIcon(), size: 22, lineWidth: 2.2, fill: liked ? Tokens.Colors.magenta : nil).foregroundStyle(Tokens.Colors.magenta)
            } action: { marks.toggle(.liked, poemPath: model.path, couplet: couplet) }
            Spacer()
            let reposted = marks.contains(.reposted, poemPath: model.path, couplet: couplet)
            round("بازنشر", on: reposted) {
                LineIcon(shape: RepostIcon(), size: 22, lineWidth: 2.2, fill: nil).foregroundStyle(reposted ? Tokens.Colors.lapis : Tokens.Colors.ink)
            } action: { marks.toggle(.reposted, poemPath: model.path, couplet: couplet) }
            Spacer()
            round("بفرست", on: false) {
                LineIcon(shape: MessagesIcon(), size: 22, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.ink)
            } action: {
                dismiss()
                model.shareCouplet(couplet)
            }
            Spacer()
            let kept = marks.contains(.kept, poemPath: model.path, couplet: couplet)
            round("نگه دار", on: kept) {
                LineIcon(shape: BookmarkIcon(), size: 22, lineWidth: 2.2, fill: kept ? Tokens.Colors.ink : nil).foregroundStyle(Tokens.Colors.ink)
            } action: { marks.toggle(.kept, poemPath: model.path, couplet: couplet) }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background {
            RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 10, x: 0, y: 8)
        }
    }

    private func round(_ label: String, on: Bool, @ViewBuilder icon: () -> some View, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            icon()
                .frame(width: 52, height: 52)
                .background(Circle().fill(Tokens.Colors.paper))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var list: some View {
        VStack(spacing: 0) {
            if model.hasMeaning(couplet) {
                row("معنی این بیت", BookIcon()) { withAnimation(.snappy) { model.openCouplet(couplet, withMeaning: true) } }
                rule
            }
            row("بیت به بیت، از همین بیت", CoupletFocusIcon()) { withAnimation(.snappy) { model.openCouplet(couplet) } }
            rule
            row("بازی با این بیت", GamesIcon(), action: playWithCouplet)
            rule
            row("کپی متن", CopyIcon()) {
                UIPasteboard.general.string = model.copyText(of: couplet)
                dismiss()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
        .background {
            RoundedRectangle(cornerRadius: 24).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 10, x: 0, y: 8)
        }
    }

    private var rule: some View {
        Tokens.Colors.paper.frame(height: 1)
    }

    private func row(_ title: String, _ icon: some Shape, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                LineIcon(shape: icon, size: 20, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.lapis)
                Text(title).font(.ui(15, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
