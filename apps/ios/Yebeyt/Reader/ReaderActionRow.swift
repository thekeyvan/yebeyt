import SwiftUI

/// The play / pause button of a couplet: lapis with two bars while playing, light lapis with a triangle when not.
struct PlayToggle: View {
    let player: RecitationPlayer
    let toggle: () -> Void
    var diameter: CGFloat = 34

    var body: some View {
        let on = player.isPlaying
        Button(action: toggle) {
            ZStack {
                Circle().fill(on ? Tokens.Colors.lapis : Tokens.Colors.lapisTint)
                if on {
                    HStack(spacing: 3) {
                        RoundedRectangle(cornerRadius: 2).frame(width: 3.5, height: 12)
                        RoundedRectangle(cornerRadius: 2).frame(width: 3.5, height: 12)
                    }
                    .foregroundStyle(Tokens.Colors.white)
                } else {
                    PlayIcon().fill(Tokens.Colors.lapis).frame(width: 14, height: 14)
                }
            }
            .frame(width: diameter, height: diameter)
            .frame(width: 44, height: 44)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(on ? "مکث" : "پخش خوانش")
    }
}

/// پسند, بازنشر, بفرست and نگه دار on one couplet. The first two and the last keep their state on the phone.
struct ReaderActionRow: View {
    @Environment(ReaderMarks.self) private var marks
    @Environment(TextSettingsStore.self) private var text
    @Environment(AccountModel.self) private var account
    let model: ReaderModel
    let couplet: Int

    var body: some View {
        let theme = text.settings.theme
        HStack(spacing: 0) {
            if let player = model.player, player.isAvailable { PlayToggle(player: player) { model.togglePlayback() } }
            let liked = marks.contains(.liked, poemPath: model.path, couplet: couplet)
            button("پسند", on: liked) {
                account.require(.likes, needed: !liked) { marks.toggle(.liked, poemPath: model.path, couplet: couplet) }
            } icon: {
                LineIcon(shape: HeartIcon(), size: 21, lineWidth: 2, fill: liked ? Tokens.Colors.magenta : nil)
                    .foregroundStyle(Tokens.Colors.magenta)
            }
            let reposted = marks.contains(.reposted, poemPath: model.path, couplet: couplet)
            button("بازنشر", on: reposted) {
                account.require(.likes, needed: !reposted) { marks.toggle(.reposted, poemPath: model.path, couplet: couplet) }
            } icon: {
                LineIcon(shape: RepostIcon(), size: 21, lineWidth: 2.2, fill: nil)
                    .foregroundStyle(reposted ? Tokens.Colors.lapis : theme.foreground)
            }
            button("بفرست", on: false) {
                model.shareCouplet(couplet)
            } icon: {
                LineIcon(shape: MessagesIcon(), size: 21, lineWidth: 2.2, fill: nil).foregroundStyle(theme.foreground)
            }
            let kept = marks.contains(.kept, poemPath: model.path, couplet: couplet)
            button("نگه دار", on: kept) {
                marks.toggle(.kept, poemPath: model.path, couplet: couplet)
            } icon: {
                LineIcon(shape: BookmarkIcon(), size: 21, lineWidth: 2.2, fill: kept ? theme.foreground : nil)
                    .foregroundStyle(theme.foreground)
            }
        }
    }

    private func button(_ label: String, on: Bool, action: @escaping () -> Void, @ViewBuilder icon: () -> some View) -> some View {
        Button(action: action) {
            icon().frame(width: 43, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
