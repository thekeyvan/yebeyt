import SwiftUI
import UIKit

extension Notification.Name {
    /// The phone was shaken (posted by `UIWindow.motionEnded`).
    static let deviceDidShake = Notification.Name("com.yebeyt.deviceDidShake")
}

extension UIWindow {
    /// A shake reaches the window whatever has the focus: the one place that sees it everywhere in the app.
    open override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        super.motionEnded(motion, with: event)
        if motion == .motionShake { NotificationCenter.default.post(name: .deviceDidShake, object: nil) }
    }
}

/// The real presenter: the feedback sheet is a UIKit sheet over the topmost screen, so it opens over the reader, a game
/// or another sheet alike. The choices start as a short sheet; picking a type grows it to the full form.
@MainActor
final class FeedbackSheetPresenter: NSObject, FeedbackPresenting, UIAdaptivePresentationControllerDelegate {
    private weak var host: UIViewController?
    private weak var center: FeedbackCenter?

    func present(_ center: FeedbackCenter) {
        self.center = center
        guard host == nil, let top = Self.topViewController() else { return }
        let controller = UIHostingController(rootView: FeedbackSheetRoot(center: center))
        controller.view.backgroundColor = .clear
        controller.overrideUserInterfaceStyle = .light
        controller.modalPresentationStyle = .pageSheet
        controller.presentationController?.delegate = self
        if let sheet = controller.sheetPresentationController {
            sheet.preferredCornerRadius = 30
            sheet.prefersGrabberVisible = true
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
            if center.stage == .choices {
                sheet.detents = [.custom(identifier: .init("choices")) { context in min(520, context.maximumDetentValue) }]
            } else {
                sheet.detents = [.large()]
            }
        }
        host = controller
        top.present(controller, animated: true)
    }

    func expandToForm() {
        guard let host, let sheet = host.sheetPresentationController else { return }
        sheet.animateChanges {
            sheet.detents = [.large()]
            sheet.selectedDetentIdentifier = .large
        }
    }

    func dismiss() async {
        guard let host else { return }
        self.host = nil
        await withCheckedContinuation { continuation in
            host.dismiss(animated: true) { continuation.resume() }
        }
    }

    /// A swipe down was refused because something is written (`interactiveDismissDisabled` in `FeedbackSheetRoot`): ask.
    func presentationControllerDidAttemptToDismiss(_ presentationController: UIPresentationController) {
        guard let center else { return }
        Task { await center.requestClose() }
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        host = nil
        center?.dismissedBySwipe()
    }

    /// The screen in front: the key window's root, then whatever is presented over it, over that, and so on.
    static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        var top = scenes.flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController
        while let next = top?.presentedViewController, !next.isBeingDismissed { top = next }
        return top
    }
}

/// A window above the app that takes touches only inside `touchRect` (its content): every other touch goes to the app
/// below. (SwiftUI answers hit tests with its hosting view, so the content's own frame is what is compared.)
final class PassthroughWindow: UIWindow {
    var touchRect = CGRect.zero

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        touchRect.contains(point) ? super.hitTest(point, with: event) : nil
    }
}

/// Two windows above everything, both as big as the screen so that no frame can drift from what is drawn: the recording
/// pill (only the pill takes touches, every other touch goes to the app, over the games, the reader and sheets alike) and
/// the toast after sending (it takes no touches).
@MainActor
final class FeedbackOverlay {
    private var pillWindow: UIWindow?
    private var toastWindow: UIWindow?

    func showPill(for center: FeedbackCenter) {
        guard pillWindow == nil, let scene = Self.scene else { return }
        let window = PassthroughWindow(windowScene: scene)
        window.windowLevel = .alert + 1
        window.rootViewController = Self.host(RecordingPillHost(center: center) { [weak window] in window?.touchRect = $0 })
        window.isHidden = false
        pillWindow = window
    }

    func hidePill() {
        pillWindow?.isHidden = true
        pillWindow = nil
    }

    func showToast(for center: FeedbackCenter) {
        guard toastWindow == nil, let scene = Self.scene else { return }
        let window = UIWindow(windowScene: scene)
        window.windowLevel = .alert + 1
        window.isUserInteractionEnabled = false
        window.rootViewController = Self.host(FeedbackToastView(center: center))
        window.isHidden = false
        toastWindow = window
    }

    func hideToast() {
        toastWindow?.isHidden = true
        toastWindow = nil
    }

    private static var scene: UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
    }

    private static func host(_ view: some View) -> UIViewController {
        let controller = UIHostingController(rootView: view)
        controller.view.backgroundColor = .clear
        return controller
    }
}
