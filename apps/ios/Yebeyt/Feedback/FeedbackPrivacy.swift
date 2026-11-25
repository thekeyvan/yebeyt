import SwiftUI
import UIKit
import Observation

/// What a report must never carry: what the person typed and the messages (docs/yebeyt-2.md, privacy). A view that shows
/// such content says `.feedbackPrivate()`. Two things follow from it:
/// - the screenshot of the screen is taken with a blank painted over each of those views (`ScreenshotCapture`);
/// - while the screen is recorded, those views are drawn covered (`covering`), so the video never shows them.
@MainActor @Observable
final class FeedbackPrivacy {
    static let shared = FeedbackPrivacy()

    /// A recording is on: private views draw their blank.
    var covering = false
    /// The rects the last screenshot painted over (window coordinates), for the debug hook of the UI tests.
    @ObservationIgnored private(set) var lastRedacted: [CGRect] = []
    /// A small view behind each private view. Where it is is asked only when a screenshot is taken (so scrolling and the
    /// keyboard moving things cost nothing, and the answer is where the view is drawn at that moment).
    @ObservationIgnored private let anchors = NSHashTable<UIView>.weakObjects()

    func register(_ anchor: UIView) { anchors.add(anchor) }

    /// The frames, in `window`'s coordinates, of the private views that are in it and on screen.
    func rects(in window: UIWindow) -> [CGRect] {
        anchors.allObjects.compactMap { anchor in
            guard anchor.window === window, !anchor.isHidden else { return nil }
            let rect = anchor.drawnFrame(in: window)
            return rect.isNull || rect.width <= 0 || rect.height <= 0 ? nil : rect
        }
    }

    func recordRedaction(_ rects: [CGRect]) { lastRedacted = rects }
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

/// The view behind a private view: it only has to be where that view is.
private struct PrivateAnchor: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.isUserInteractionEnabled = false
        FeedbackPrivacy.shared.register(view)
        return view
    }

    func updateUIView(_ view: UIView, context: Context) {}
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
