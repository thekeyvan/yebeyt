import SwiftUI
import UIKit

/// The couplet a long press lifted, with the words the menu writes around it. The reader builds it from the open
/// poem; the divan (and later the home, games and messages) from the poem of a kept couplet.
struct HeldCouplet: Equatable, Identifiable {
    let path: String
    /// 0-based, as in the reader.
    let index: Int
    let couplet: Couplet
    /// «حافظ · غزل ۳ · بیت ۲»
    let caption: String
    let shareText: String
    let copyText: String
    /// Set when the long press happened in a chat: the person whose shared divan «به دیوان مشترک» goes to.
    var sharedWith: ChatPerson?
    /// Set when the long press happened on a couplet I added to a shared divan: the menu then offers «بردار».
    var removal: SharedDivanRemoval?

    var id: String { ReaderMarks.key(poemPath: path, couplet: index) }
    var hasMeaning: Bool { couplet.meaning != nil }
}

/// A couplet of a shared divan that I added, which the menu can take out again («بردار»): the divan is the one with
/// `username`, the item is the server's id.
struct SharedDivanRemoval: Equatable {
    let username: String
    let itemID: String
}

/// A long press on a couplet: the page blurs, the couplet is lifted on a tilted card, with a row of icons and a list.
struct HoldMenu: View {
    @Environment(TextSettingsStore.self) private var text
    @Environment(ReaderMarks.self) private var marks
    @Environment(AccountModel.self) private var account
    let held: HeldCouplet
    let dismiss: () -> Void
    /// بفرست: the share sheet with the couplet.
    let share: () -> Void
    /// «معنی این بیت» (true) and «بیت به بیت، از همین بیت» (false): the couplet's page in the reader.
    let openCouplet: (_ withMeaning: Bool) -> Void
    let playWithCouplet: (Int) -> Void
    /// «به دیوان مشترک»: the sheet that adds this couplet to a shared divan.
    let addToSharedDivan: () -> Void
    /// Taking the couplet out of the divan shows a toast with «برگردون»: the screen's toast takes the line and the way back.
    let offerUndo: (String, ToastUndo) -> Void
    /// «بردار»: asks (the shared divan's screen does) before the couplet goes out of the shared divan.
    var removeFromSharedDivan: (SharedDivanRemoval) -> Void = { _ in }

    /// The board puts the lifted couplet 258pt below the top of the screen (844pt tall).
    private static let boardTop: CGFloat = 258
    private static let bottomMargin: CGFloat = 24
    /// Where the menu grows from: the lifted couplet, a third of the way down.
    static let origin = UnitPoint(x: 0.5, y: 0.35)

    @State private var menuHeight: CGFloat = 0

    var body: some View {
        GeometryReader { screen in
            ZStack(alignment: .top) {
                Tokens.Colors.ink.opacity(0.38)
                    .contentShape(Rectangle())
                    .onTapGesture(perform: dismiss)
                    .accessibilityHidden(true)
                ScrollView {
                    menu
                        .background {
                            GeometryReader { proxy in
                                Color.clear.onAppear { menuHeight = proxy.size.height }
                                    .onChange(of: proxy.size.height) { _, new in menuHeight = new }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, top(screenHeight: screen.size.height, safeTop: screen.safeAreaInsets.top))
                        .padding(.bottom, Self.bottomMargin)
                        // The scroll view fills the screen, so a tap on its empty part has to dismiss too.
                        .frame(maxWidth: .infinity, minHeight: screen.size.height, alignment: .top)
                        .background(Color.clear.contentShape(Rectangle()).onTapGesture(perform: dismiss))
                }
                .scrollBounceBehavior(.basedOnSize)
                .scrollIndicators(.hidden)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("کارهای این بیت")
            .accessibilityAddTraits(.isModal)
            .accessibilityAction(.escape, dismiss)
        }
        .ignoresSafeArea()
    }

    private var menu: some View {
        VStack(spacing: 12) {
            lifted
            icons
            list
        }
    }

    /// The board's top, moved up on a short screen so the whole menu stays in view (never above the status bar).
    private func top(screenHeight: CGFloat, safeTop: CGFloat) -> CGFloat {
        max(min(Self.boardTop, screenHeight - menuHeight - Self.bottomMargin), safeTop + 8)
    }

    /// The held couplet: bigger, tilted, with a long shadow, like a sticker in the hand.
    private var lifted: some View {
        let settings = text.settings
        return VStack(spacing: 0) {
            CoupletText(couplet: held.couplet, settings: settings, size: settings.listSize, factor: settings.listFactor, color: Tokens.Colors.ink)
            Text(held.caption)
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
            let (path, couplet) = (held.path, held.index)
            let liked = marks.contains(.liked, poemPath: path, couplet: couplet)
            round("پسند", .like, on: liked) {
                LineIcon(shape: HeartIcon(), size: 22, lineWidth: 2.2, fill: liked ? Tokens.Colors.magenta : nil).foregroundStyle(Tokens.Colors.magenta)
            } action: { account.require(.likes, needed: !liked) { marks.toggle(.liked, poemPath: path, couplet: couplet) } }
            Spacer()
            let reposted = marks.contains(.reposted, poemPath: path, couplet: couplet)
            round("بازنشر", .repost, on: reposted) {
                LineIcon(shape: RepostIcon(), size: 22, lineWidth: 2.2, fill: nil).foregroundStyle(reposted ? Tokens.Colors.lapis : Tokens.Colors.ink)
            } action: { account.require(.likes, needed: !reposted) { marks.toggle(.reposted, poemPath: path, couplet: couplet) } }
            Spacer()
            round("بفرست", .send, on: false) {
                LineIcon(shape: MessagesIcon(), size: 22, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.ink)
            } action: {
                dismiss()
                share()
            }
            Spacer()
            let kept = marks.contains(.kept, poemPath: path, couplet: couplet)
            round("نگه دار", .keep, on: kept) {
                LineIcon(shape: BookmarkIcon(), size: 22, lineWidth: 2.2, fill: kept ? Tokens.Colors.ink : nil).foregroundStyle(Tokens.Colors.ink)
            } action: { marks.toggleKept(poemPath: path, couplet: couplet, offerUndo: offerUndo) }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background {
            RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 10, x: 0, y: 8)
        }
    }

    private func round(_ label: String, _ mark: Burst.Action, on: Bool, @ViewBuilder icon: @escaping () -> some View, action: @escaping () -> Void) -> some View {
        MarkButton(action: action) { taps in
            icon()
                .markMotion(mark, on: on, taps: taps)
                .frame(width: 52, height: 52)
                .background(Circle().fill(Tokens.Colors.paper))
        }
        .buttonStyle(.press)
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var list: some View {
        VStack(spacing: 0) {
            if held.hasMeaning {
                row("معنی این بیت", BookIcon()) { openCouplet(true) }
                rule
            }
            row("بیت به بیت، از همین بیت", CoupletFocusIcon()) { openCouplet(false) }
            rule
            row("بازی با این بیت", GamesIcon()) { playWithCouplet(held.index) }
            rule
            row("به دیوان مشترک", SharedDivanBooksIcon()) { account.require(.messages) { addToSharedDivan() } }
            rule
            row("کپی متن", CopyIcon()) {
                UIPasteboard.general.string = held.copyText
                dismiss()
            }
            if let removal = held.removal {
                rule
                row("بردار", CloseIcon(), destructive: true) { removeFromSharedDivan(removal) }
                    .accessibilityIdentifier("removeFromSharedDivan")
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

    private func row(_ title: String, _ icon: some Shape, destructive: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                LineIcon(shape: icon, size: 20, lineWidth: 2.2, fill: nil).foregroundStyle(destructive ? Tokens.Colors.fire : Tokens.Colors.lapis)
                Text(title).font(.ui(15, weight: .medium)).foregroundStyle(destructive ? Tokens.Colors.fire : Tokens.Colors.ink)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
