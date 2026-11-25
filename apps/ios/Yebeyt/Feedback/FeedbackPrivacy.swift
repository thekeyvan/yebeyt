import SwiftUI
import UIKit
import Observation

/// What a report must never carry: what the person typed and the messages (docs/yebeyt-2.md, privacy). A view that shows
/// such content says `.feedbackPrivate()`, after its own box (padding, background), so that the modifier's view is the box.
/// Two things follow from it:
/// - the screenshot of the screen is taken with a blank painted over each of those views (`ScreenshotCapture`);
/// - while the screen is recorded, those views are drawn covered (`covering`), so the video never shows them.
/// The same box is what a tap must be outside of to close the keyboard (`Keyboard`).
@MainActor @Observable
final class FeedbackPrivacy {
    static let shared = FeedbackPrivacy()

    /// A recording is on (or about to start, or just stopped): private views draw their blank.
    var covering = false
    #if DEBUG
    /// The rects the last screenshot painted over (window coordinates), for the debug hook of the UI tests.
    @ObservationIgnored private(set) var lastRedacted: [CGRect] = []
    #endif
    /// A small view behind each private view. Where it is is asked only when a screenshot is taken (so scrolling and the
    /// keyboard moving things cost nothing, and the answer is where the view is drawn at that moment).
    @ObservationIgnored private let anchors = NSHashTable<PrivateAnchorView>.weakObjects()
    /// How many covers (the reader, a game) are mounted: they are opaque and full screen, so what is under them is not seen.
    @ObservationIgnored private var coversMounted = 0

    func register(_ anchor: PrivateAnchorView) { anchors.add(anchor) }
    func coverAppeared() { coversMounted += 1 }
    func coverDisappeared() { coversMounted = max(0, coversMounted - 1) }

    /// The frames, in `window`'s coordinates, of the private views that are on screen and not hidden under a cover or a
    /// sheet.
    func rects(in window: UIWindow) -> [CGRect] {
        let chain = Self.presentationChain(of: window)
        return anchors.allObjects.compactMap { anchor in
            guard anchor.window === window, !anchor.isHidden, anchor.inCover || coversMounted == 0 else { return nil }
            let rect = anchor.drawnFrame(in: window)
            guard !rect.isNull, rect.width > 0, rect.height > 0 else { return nil }
            let level = Self.level(of: anchor, in: chain)
            let centre = CGPoint(x: rect.midX, y: rect.midY)
            let hidden = chain.dropFirst(level + 1).contains { sheet in
                guard let view = sheet.viewIfLoaded else { return false }
                return view.drawnFrame(in: window).contains(centre)
            }
            return hidden ? nil : rect
        }
    }

    /// The root view controller and what is presented over it, over that, and so on.
    private static func presentationChain(of window: UIWindow) -> [UIViewController] {
        var chain = window.rootViewController.map { [$0] } ?? []
        while let next = chain.last?.presentedViewController, !next.isBeingDismissed { chain.append(next) }
        return chain
    }

    /// Which presentation the view belongs to: 0 is the screen under every sheet.
    private static func level(of view: UIView, in chain: [UIViewController]) -> Int {
        var current: UIView? = view
        while let candidate = current {
            if let index = chain.firstIndex(where: { $0.viewIfLoaded === candidate }) { return index }
            current = candidate.superview
        }
        return 0
    }

    /// The box of the field drawn at `field`: the smallest private view around it (the capsule, the rounded rectangle it is
    /// typed in), else the field itself.
    func box(around field: CGRect, in window: UIWindow) -> CGRect {
        anchors.allObjects
            .filter { $0.window === window }
            .map { $0.drawnFrame(in: window) }
            .filter { $0.insetBy(dx: -1, dy: -1).contains(field) }
            .min { $0.width * $0.height < $1.width * $1.height } ?? field
    }

    #if DEBUG
    func recordRedaction(_ rects: [CGRect]) { lastRedacted = rects }
    #endif
}

/// The view behind a private view: it only has to be where that view is.
final class PrivateAnchorView: UIView {
    /// It belongs to a cover (`CoverLayer`'s content), which is in front of everything else.
    var inCover = false
}

private struct InCoverKey: EnvironmentKey { static let defaultValue = false }

extension EnvironmentValues {
    /// Set by `CoverLayer` for what it shows.
    var feedbackInCover: Bool {
        get { self[InCoverKey.self] }
        set { self[InCoverKey.self] = newValue }
    }
}

/// The blank that stands in for private content: a sticker-blank in the track colour.
enum PrivateBlank {
    static let color = UIColor(Tokens.Colors.trackLight)

    static func radius(of rect: CGRect) -> CGFloat { min(14, min(rect.width, rect.height) / 2) }

    static func paint(_ rects: [CGRect], in context: CGContext) {
        context.setFillColor(color.cgColor)
        for rect in rects {
            context.addPath(UIBezierPath(roundedRect: rect, cornerRadius: radius(of: rect)).cgPath)
            context.fillPath()
        }
    }
}

private struct PrivateAnchor: UIViewRepresentable {
    @Environment(\.feedbackInCover) private var inCover

    func makeUIView(context: Context) -> PrivateAnchorView {
        let view = PrivateAnchorView()
        view.isUserInteractionEnabled = false
        FeedbackPrivacy.shared.register(view)
        return view
    }

    func updateUIView(_ view: PrivateAnchorView, context: Context) { view.inCover = inCover }
}

private struct FeedbackPrivate: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background { PrivateAnchor().allowsHitTesting(false).accessibilityHidden(true) }
            .overlay {
                if FeedbackPrivacy.shared.covering {
                    RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.trackLight)
                        .accessibilityElement()
                        .accessibilityLabel("پنهان")
                        .accessibilityIdentifier("feedbackCover")
                }
            }
    }
}

extension View {
    /// This view shows what the person typed or what was said in a message: it is blanked out of feedback screenshots and
    /// of screen recordings.
    func feedbackPrivate() -> some View { modifier(FeedbackPrivate()) }
}

extension UIView {
    /// Where the view is drawn, in `window`'s coordinates: the part not clipped by an ancestor (a scroll view) and on screen.
    /// It goes by the presentation layers, which hold what is drawn: SwiftUI can have moved a platform view (for the
    /// keyboard) in a way its model frame doesn't show.
    func drawnFrame(in window: UIWindow) -> CGRect {
        let target = window.layer.presentation() ?? window.layer
        func frame(of view: UIView) -> CGRect {
            let layer = view.layer.presentation() ?? view.layer
            return layer.convert(layer.bounds, to: target)
        }
        var rect = frame(of: self)
        var ancestor = superview
        while let current = ancestor, current !== window {
            if current.clipsToBounds { rect = rect.intersection(frame(of: current)) }
            ancestor = current.superview
        }
        return rect.intersection(window.bounds)
    }
}
