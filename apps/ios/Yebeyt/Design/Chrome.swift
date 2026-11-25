import SwiftUI

/// The round white button of the screen headers (back, bookmark): 44pt, soft shadow.
struct RoundButton<Content: View>: View {
    let label: String
    let action: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        Button(action: action) {
            content
                .frame(width: 44, height: 44)
                .background(Circle().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.16), radius: 4, x: 0, y: 2))
        }
        .buttonStyle(.press)
        .accessibilityLabel(label)
    }
}

/// The back button of pushed screens: a round button with the chevron pointing right.
struct BackButton: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        RoundButton(label: "برگشت", action: { dismiss() }) {
            LineIcon(shape: ChevronRightIcon(), size: 20, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.ink)
        }
        .accessibilityIdentifier("back")
    }
}

/// The header of Library, Section and similar screens: back button, title (Lalezar 30) and a small line under it.
struct ScreenHeader: View {
    let title: String
    var subtitle: String?

    var body: some View {
        HStack(spacing: 12) {
            BackButton()
            VStack(alignment: .leading, spacing: 0) {
                Text(title).font(.title(30)).foregroundStyle(Tokens.Colors.ink).lineLimit(2)
                    .accessibilityAddTraits(.isHeader)
                if let subtitle {
                    Text(subtitle).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

/// Pins a screen's top navigation (back or close, and the title row with it) above the content, which scrolls under it.
/// The pinned area is the page's own dotted paper (or `paper`, a flat colour, on the feedback boards), so nothing shows
/// through, and a thin shadow appears once something has scrolled under it. Put it on the screen's `ScrollView`; the
/// header keeps its place in VoiceOver order, first.
struct StickyHeader<Header: View>: ViewModifier {
    let header: Header
    var paper: Color?
    @State private var scrolledUnder = false

    /// Before iOS 18 nothing can tell how far a scroll view went: only the hairline stays on, without the shadow.
    private var tracksScroll: Bool {
        if #available(iOS 18, *) { return true }
        return false
    }

    func body(content: Content) -> some View {
        content
            .safeAreaInset(edge: .top, spacing: 0) {
                header
                    .padding(.horizontal, 18)
                    .padding(.top, 6)
                    .padding(.bottom, 8)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())  // a tap on the padding must not reach the row scrolled under it
                    .background {
                        if let paper { paper.ignoresSafeArea(edges: .top) } else { DottedPaper().ignoresSafeArea(edges: .top) }
                    }
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(Tokens.Colors.ink.opacity(0.1)).frame(height: 1)
                            .opacity(scrolledUnder || !tracksScroll ? 1 : 0)
                    }
                    .shadow(color: Tokens.Colors.ink.opacity(scrolledUnder ? 0.08 : 0), radius: 4, x: 0, y: 2)
                    .animation(.easeOut(duration: 0.15), value: scrolledUnder)
            }
            .modifier(ScrollUnderTracker(scrolledUnder: $scrolledUnder))
    }
}

/// Tells the sticky header whether the content has moved up under it (iOS 18 and later).
private struct ScrollUnderTracker: ViewModifier {
    @Binding var scrolledUnder: Bool

    func body(content: Content) -> some View {
        if #available(iOS 18, *) {
            content.onScrollGeometryChange(for: Bool.self) { geometry in
                geometry.contentOffset.y + geometry.contentInsets.top > 2
            } action: { _, under in
                scrolledUnder = under
            }
        } else {
            content
        }
    }
}

extension View {
    /// `ScrollView { … }.stickyHeader { BackButton() … }`: the header stays at the top while the content scrolls.
    func stickyHeader<Header: View>(paper: Color? = nil, @ViewBuilder _ header: () -> Header) -> some View {
        modifier(StickyHeader(header: header(), paper: paper))
    }
}

/// «شاعرها … همه»: a Lalezar heading with a link at the other end.
struct SectionHeading: View {
    let title: String
    var link: String?
    var destination: Destination?

    var body: some View {
        HStack {
            Text(title).font(.title(22)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
            Spacer()
            if let link, let destination {
                NavigationLink(value: destination) {
                    Text(link).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                }
            }
        }
    }
}

/// The search field of the library screens: a white box with the magnifier.
struct SearchBox: View {
    enum Style { case round, square }

    @Binding var text: String
    let placeholder: String
    var style = Style.square
    var focus: FocusState<Bool>.Binding?

    var body: some View {
        let round = style == .round
        HStack(spacing: 10) {
            LineIcon(shape: ExploreIcon(), size: round ? 20 : 18, lineWidth: round ? 2.4 : 2.2, fill: nil).foregroundStyle(Tokens.Colors.muted)
            field
        }
        .padding(.horizontal, 16)
        .frame(height: round ? 50 : 48)
        .background {
            RoundedRectangle(cornerRadius: round ? 25 : 16)
                .fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(round ? 0.12 : 0.06), radius: round ? 5 : 4, x: 0, y: 2)
        }
        .feedbackPrivate()
    }

    @ViewBuilder private var field: some View {
        let input = TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(Color(hex: 0x8A8698)))
            .font(.ui(style == .round ? 15 : 14))
            .foregroundStyle(Tokens.Colors.ink)
            .submitLabel(.search)
            .autocorrectionDisabled()
        if let focus { input.focused(focus) } else { input }
    }
}

/// The white card of a list row (sections, poems, search results).
extension View {
    func listCard(fill: Color = Tokens.Colors.white, radius: CGFloat = 18) -> some View {
        background {
            RoundedRectangle(cornerRadius: radius).fill(fill)
                .shadow(color: Tokens.Colors.ink.opacity(0.05), radius: 4, x: 0, y: 2)
        }
    }
}

/// Our screens hide the system navigation bar for their round back button, which switches off the edge-swipe
/// back gesture. Put `.swipeBack()` on the first screen of a stack to turn it on again for that stack only.
struct SwipeBack: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> Probe { Probe() }
    func updateUIViewController(_ controller: Probe, context: Context) {}

    final class Probe: UIViewController {
        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            navigationController?.interactivePopGestureRecognizer?.delegate = SwipeBackDelegate.shared
        }
    }
}

/// Lets the swipe begin only when there is a screen to go back to, and not while the screen in front has something to lose
/// (`blocked`: the face screen with changes not saved, where the question is the only way out).
final class SwipeBackDelegate: NSObject, UIGestureRecognizerDelegate {
    static let shared = SwipeBackDelegate()
    /// Set by the screen in front, and cleared when it goes.
    @MainActor static var blocked = false

    static func allows(stackDepth: Int, blocked: Bool) -> Bool { stackDepth > 1 && !blocked }

    func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
        var responder: UIResponder? = recognizer.view
        while let current = responder {
            if let navigation = current as? UINavigationController {
                return MainActor.assumeIsolated { Self.allows(stackDepth: navigation.viewControllers.count, blocked: Self.blocked) }
            }
            responder = current.next
        }
        return false
    }
}

extension View {
    func swipeBack() -> some View {
        background(SwipeBack().frame(width: 0, height: 0))
    }
}
