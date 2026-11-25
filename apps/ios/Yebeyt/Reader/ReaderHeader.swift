import SwiftUI

/// The header both reading modes share: the grabber, close, title and subtitle, the game button and «آ», with the mode
/// toggle under it. It is one view above the mode's content, so switching modes can't move it. The reader is a bottom
/// sheet, and this is its handle: a drag down on it closes the reader (`ReaderView`).
struct ReaderHeader: View {
    let model: ReaderModel
    let theme: ReaderTheme
    let close: () -> Void
    let playWithPoem: () -> Void
    let openPoet: (() -> Void)?

    private var isLoaded: Bool { model.phase == .loaded }

    var body: some View {
        VStack(spacing: 12) {
            Capsule().fill(theme.secondary.opacity(0.4)).frame(width: 40, height: 5)
                .padding(.top, 2)
                .accessibilityHidden(true)
            HStack(spacing: 10) {
                circle(label: "بستن", action: close) {
                    LineIcon(shape: ChevronDownIcon(), size: 22, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.ink)
                }
                VStack(spacing: 0) {
                    Text(model.content?.title ?? " ")
                        .font(.title(20))
                        .lineLimit(1)
                        .foregroundStyle(theme.foreground)
                        .accessibilityIdentifier("readerTitle")
                    Text(model.content?.subtitle ?? " ")
                        .font(.ui(12))
                        .lineLimit(1)
                        .foregroundStyle(theme.secondary)
                        .accessibilityIdentifier("readerSubtitle")
                        .onTapGesture { openPoet?() }
                        .accessibilityAddTraits(openPoet == nil ? [] : .isButton)
                }
                .frame(maxWidth: .infinity)
                circle(label: "بازی با این غزل", action: playWithPoem) {
                    LineIcon(shape: GamesIcon(), size: 20, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.lapis)
                }
                .disabled(!isLoaded)
                circle(label: "اندازه‌ی حروف") { model.textSheetOpen = true } content: {
                    Text("آ").font(.title(18, scaled: false)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3)
                }
                .disabled(!isLoaded)
            }
            .padding(.horizontal, 18)
            if isLoaded { ModeToggle(mode: Binding(get: { model.mode }, set: { model.setMode($0) })) }
        }
    }

    private func circle(label: String, action: @escaping () -> Void, @ViewBuilder content: () -> some View) -> some View {
        Button(action: action) {
            content()
                .frame(width: 44, height: 44)
                .background(Circle().fill(Tokens.Colors.white))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// «بیت به بیت / کل شعر».
struct ModeToggle: View {
    @Binding var mode: ReaderMode

    var body: some View {
        HStack(spacing: 2) {
            segment("بیت به بیت", .couplet)
            segment("کل شعر", .scroll)
        }
        .padding(3)
        .background {
            Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 4, x: 0, y: 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("حالت خوندن")
    }

    private func segment(_ title: String, _ value: ReaderMode) -> some View {
        let on = mode == value
        return Button {
            mode = value
        } label: {
            Text(title)
                .font(.ui(13, weight: on ? .bold : .medium, scaled: false))
                .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(Capsule().fill(on ? Tokens.Colors.lapis : .clear))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
