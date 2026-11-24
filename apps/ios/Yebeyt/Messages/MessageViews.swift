import SwiftUI

/// A person's face on a white-bordered round sticker, with the green dot when they are online.
struct Face: View {
    let parts: AvatarParts?
    var size: CGFloat = 52
    var border: CGFloat = 3
    var online = false

    var body: some View {
        // Left-to-right inside, so the dot's bottom-left corner is the board's (physical) one.
        ZStack(alignment: .bottomLeading) {
            Circle()
                .fill(Tokens.Colors.white)
                .overlay(AvatarView(parts: parts ?? .standard).padding(max(border - size * 0.02, 0)))
                .stickerShadow(ShadowToken(y: 1, blur: 8, opacity: 0.22))
            if online {
                Circle()
                    .fill(Tokens.Colors.green)
                    .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .frame(width: 14, height: 14)
                    .offset(x: -2, y: 2)
                    .accessibilityHidden(true)
            }
        }
        .frame(width: size, height: size)
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityHidden(true)
    }
}

/// The two columns of the shared-divan icon (the board's book).
struct SharedDivanIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z").path(in: rect)
    }
}

/// «به دیوان مشترک» in the hold menu: two books, one in front of the other (our own icon).
struct SharedDivanBooksIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M4 8.5A2 2 0 0 1 6 6.5H13A2 2 0 0 1 15 8.5V18.5A2 2 0 0 1 13 20.5H6A2 2 0 0 1 4 18.5ZM7.5 6.5V20.5M9 6.5V6A2 2 0 0 1 11 4H18A2 2 0 0 1 20 6V16A2 2 0 0 1 18 18H15").path(in: rect)
    }
}

/// The way back a toast offers for something done at once («از دیوانت برداشته شد» with «برگردون»).
struct ToastUndo {
    var title = "برگردون"
    let run: @MainActor () -> Void

    init(_ run: @escaping @MainActor () -> Void) {
        self.run = run
    }
}

/// How long a toast stays.
enum ToastTiming {
    /// The seconds before it goes by itself; nil when it stays until it is dismissed or acted on: a toast with an undo, for
    /// someone using VoiceOver, who needs longer than 5 seconds to find the button.
    static func seconds(hasUndo: Bool, voiceOver: Bool) -> Double? {
        guard hasUndo else { return 2.5 }
        return voiceOver ? nil : 5
    }

    @MainActor static func seconds(hasUndo: Bool) -> Double? {
        seconds(hasUndo: hasUndo, voiceOver: UIAccessibility.isVoiceOverRunning)
    }
}

/// A line that says something for a moment, over the bottom of a screen: ink capsule, white text; with an `undo`, a button at its end.
struct MessageToast: View {
    let text: String
    var undo: ToastUndo?
    /// Called when the toast should go: after the undo ran, or when VoiceOver dismisses it.
    var dismiss: () -> Void = {}

    var body: some View {
        HStack(spacing: 14) {
            Text(text)
            if let undo {
                Button {
                    undo.run()
                    dismiss()
                } label: {
                    Text(undo.title).font(.ui(13, weight: .bold)).underline()
                        .padding(.vertical, 8).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(undo.title)
                .accessibilityIdentifier("toastUndo")
            }
        }
        .font(.ui(13, weight: .medium))
        .foregroundStyle(Tokens.Colors.white)
        .padding(.horizontal, 16)
        .padding(.vertical, undo == nil ? 9 : 1)
        .background(Capsule().fill(Tokens.Colors.ink))
        .toastTransition()
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isStaticText)
        .accessibilityAction(.escape, dismiss)
        .modifier(UndoAction(undo: undo, dismiss: dismiss))
        // VoiceOver can't see it come and go: it is said aloud.
        .onChange(of: text, initial: true) { _, line in AccessibilityNotification.Announcement(line).post() }
    }

    /// «برگردون» as an action of the whole toast, for VoiceOver's actions rotor.
    private struct UndoAction: ViewModifier {
        let undo: ToastUndo?
        let dismiss: () -> Void

        func body(content: Content) -> some View {
            if let undo {
                content.accessibilityAction(named: Text(undo.title)) {
                    undo.run()
                    dismiss()
                }
            } else {
                content
            }
        }
    }
}

extension View {
    /// Shows `text` as a toast at the bottom and clears it after a moment (longer with an `undo`, so there is time to tap it;
    /// with VoiceOver it stays until dismissed). `serial` changes with every new toast, so the same line shown again starts
    /// its time over.
    func messageToast(_ text: Binding<String?>, undo: ToastUndo? = nil, serial: Int = 0, bottom: CGFloat = 96) -> some View {
        overlay(alignment: .bottom) {
            if let line = text.wrappedValue {
                MessageToast(text: line, undo: undo, dismiss: { text.wrappedValue = nil })
                    .padding(.bottom, bottom)
                    .task(id: ToastRun(line: line, serial: serial)) {
                        guard let seconds = ToastTiming.seconds(hasUndo: undo != nil) else { return }
                        try? await Task.sleep(for: .seconds(seconds))
                        if !Task.isCancelled, text.wrappedValue == line { text.wrappedValue = nil }
                    }
            }
        }
        .animation(Motion.bouncy, value: text.wrappedValue)
    }
}

/// One showing of a toast: a new `serial` is a new showing, even of the same line.
private struct ToastRun: Hashable {
    let line: String
    let serial: Int
}
