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
            sheet.prefersGrabberVisible = false
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
            if center.stage == .choices {
                sheet.detents = [.custom(identifier: .init("choices")) { context in min(520, context.maximumDetentValue) }]
            } else {
                sheet.detents = [.large()]
                controller.isModalInPresentation = true
            }
        }
        host = controller
        top.present(controller, animated: true)
    }

    func expandToForm() {
        guard let host, let sheet = host.sheetPresentationController else { return }
        host.isModalInPresentation = true  // a swipe must not throw away what is being written
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

/// Two small windows above everything: the recording pill (only as big as the pill, so every other touch goes to
/// the app) and the toast after sending (full screen, but it takes no touches).
@MainActor
final class FeedbackOverlay {
    private var pillWindow: UIWindow?
    private var toastWindow: UIWindow?

    func showPill(for center: FeedbackCenter) {
        guard pillWindow == nil, let scene = Self.scene else { return }
        let top = scene.windows.first(where: \.isKeyWindow)?.safeAreaInsets.top ?? 59
        let width: CGFloat = 280
        let window = UIWindow(windowScene: scene)
        window.frame = CGRect(x: (scene.screen.bounds.width - width) / 2, y: top - 12, width: width, height: 64)
        window.windowLevel = .alert + 1
        window.rootViewController = Self.host(RecordingPillHost(center: center))
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
