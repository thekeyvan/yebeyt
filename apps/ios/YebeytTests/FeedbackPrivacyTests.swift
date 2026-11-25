import Testing
import UIKit
@testable import Yebeyt

@MainActor
struct FeedbackPrivacyTests {
    private func pixel(_ image: UIImage, _ point: CGPoint) -> [UInt8] {
        var data = [UInt8](repeating: 0, count: 4)
        let context = CGContext(
            data: &data, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        context.translateBy(x: -point.x, y: -(image.size.height - point.y - 1))  // the pixel at `point`, counted from the top
        context.draw(image.cgImage!, in: CGRect(origin: .zero, size: image.size))
        return data
    }

    private func painted(_ rects: [CGRect]) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: CGSize(width: 100, height: 100), format: format).image { context in
            UIColor.red.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 100, height: 100))
            PrivateBlank.paint(rects, in: context.cgContext)
        }
    }

    private func isBlank(_ rgba: [UInt8]) -> Bool {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        PrivateBlank.color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return abs(Int(rgba[0]) - Int((r * 255).rounded())) <= 1 && abs(Int(rgba[1]) - Int((g * 255).rounded())) <= 1
            && abs(Int(rgba[2]) - Int((b * 255).rounded())) <= 1
    }

    @Test func theBlankIsPaintedOverEachRegisteredRectAndNowhereElse() {
        let image = painted([CGRect(x: 10, y: 10, width: 40, height: 20), CGRect(x: 60, y: 60, width: 30, height: 30)])
        #expect(isBlank(pixel(image, CGPoint(x: 30, y: 20))))
        #expect(isBlank(pixel(image, CGPoint(x: 75, y: 75))))
        #expect(!isBlank(pixel(image, CGPoint(x: 5, y: 5))))  // outside: the screen is as it was
        #expect(!isBlank(pixel(image, CGPoint(x: 55, y: 40))))
    }

    @Test func theAnchorsAreAskedWhereTheyAreDrawnNowAndOnlyThePartOnScreen() {
        let privacy = FeedbackPrivacy()
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        let scroller = UIView(frame: CGRect(x: 0, y: 50, width: 100, height: 100))  // moved down: its children move with it
        window.addSubview(scroller)
        let inside = UIView(frame: CGRect(x: 10, y: 10, width: 20, height: 20))
        let half = UIView(frame: CGRect(x: 0, y: 40, width: 50, height: 30))  // reaches past the window's bottom edge
        let away = UIView(frame: CGRect(x: 0, y: 500, width: 10, height: 10))
        let hidden = UIView(frame: CGRect(x: 0, y: 0, width: 10, height: 10))
        hidden.isHidden = true
        let loose = UIView(frame: CGRect(x: 0, y: 0, width: 10, height: 10))  // not in the window
        for view in [inside, half, away, hidden] { scroller.addSubview(view) }
        for view in [inside, half, away, hidden, loose] { privacy.register(view) }
        let rects = privacy.rects(in: window)
        #expect(Set(rects.map(\.debugDescription)) == Set([CGRect(x: 10, y: 60, width: 20, height: 20), CGRect(x: 0, y: 90, width: 50, height: 10)].map(\.debugDescription)))
    }

    @Test func aRecordingCoversPrivateViewsAndStoppingUncoversThem() async {
        let defaults = UserDefaults(suiteName: "privacy.tests.\(UUID().uuidString)")!
        let stub = StubServer { _ in .json(201, #"{"id":"6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11","uploadToken":"t"}"#) }
        let session = Session(api: stub.api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)"))
        let recorder = PrivacyRecorder()
        let center = FeedbackCenter(
            app: AppModel(), text: TextSettingsStore(defaults: defaults), session: session, defaults: defaults, log: FeedbackLog(),
            capture: { nil }, recorder: recorder
        )
        center.presenter = PrivacyPresenter()
        center.open(source: .settings, type: .bug)
        #expect(!FeedbackPrivacy.shared.covering)
        await center.startRecording()
        #expect(center.isRecording && FeedbackPrivacy.shared.covering)
        await center.stopRecording()
        #expect(!FeedbackPrivacy.shared.covering)
    }
}

@MainActor
private final class PrivacyRecorder: ScreenRecording {
    var isAvailable: Bool { true }
    func start() async -> ScreenRecorder.StartResult { .started }
    func stop() async -> (url: URL, seconds: Int)? { nil }
}

@MainActor
private final class PrivacyPresenter: FeedbackPresenting {
    func present(_ center: FeedbackCenter) {}
    func expandToForm() {}
    func dismiss() async {}
}
