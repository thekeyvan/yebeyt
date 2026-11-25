#if DEBUG
import SwiftUI
import UIKit

/// Debug launch arguments of the feedback slice, for simulator screenshots and UI tests:
/// `-beytFeedback shake|bug|annoyed|idea|game|liked` opens that screen (over the first screen, with a made-up screenshot;
/// `shake` is the sheet of choices as the shake opens it), `-beytFeedback recording` shows the recording pill, and
/// `-beytFeedbackFails offline|rate` makes the fake server fail sending (see `AccountLaunchOptions`), and
/// `-beytFakeRecorder 1` stands a recorder in for ReplayKit (which cannot run in the simulator): «دوباره انجامش بده» starts
/// at once and «تموم» keeps a 3-second file.
struct FeedbackLaunchOptions {
    enum Open: Equatable {
        case shake
        case type(FeedbackType)
        case recording
    }

    let open: Open?
    let fakeRecorder: Bool

    init(_ values: [String: Any]) {
        fakeRecorder = values["beytFakeRecorder"] as? String == "1"
        switch values["beytFeedback"] as? String {
        case "shake": open = .shake
        case "recording": open = .recording
        case let name?: open = FeedbackType(rawValue: name).map(Open.type)
        case nil: open = nil
        }
    }

    static var fromProcess: FeedbackLaunchOptions {
        FeedbackLaunchOptions(UserDefaults.standard.dictionaryRepresentation())
    }

    /// With a feedback screen asked for, the screenshot is a made-up one, so every run looks the same.
    @MainActor func makeCenter(app: AppModel, text: TextSettingsStore, session: Session) -> FeedbackCenter {
        FeedbackCenter(
            app: app, text: text, session: session, capture: open == nil ? { ScreenshotCapture.keyWindow() } : { Self.madeUpScreenshot },
            recorder: fakeRecorder ? FakeScreenRecorder() : ScreenRecorder()
        )
    }

    @MainActor static var madeUpScreenshot: UIImage {
        let size = CGSize(width: 390, height: 844)
        return UIGraphicsImageRenderer(size: size).image { context in
            UIColor(red: 0xF7 / 255, green: 0xF5 / 255, blue: 0xF0 / 255, alpha: 1).setFill()
            context.fill(CGRect(origin: .zero, size: size))
            UIColor.white.setFill()
            for y in stride(from: 120.0, to: 760.0, by: 110.0) {
                UIBezierPath(roundedRect: CGRect(x: 30, y: y, width: 330, height: 80), cornerRadius: 18).fill()
            }
            UIColor(red: 0x2F / 255, green: 0x35 / 255, blue: 0xF5 / 255, alpha: 1).setFill()
            UIBezierPath(roundedRect: CGRect(x: 120, y: 780, width: 150, height: 40), cornerRadius: 20).fill()
        }
    }
}

/// Records nothing: «تموم» answers a tiny file that is not a video.
@MainActor
final class FakeScreenRecorder: ScreenRecording {
    var isAvailable: Bool { true }
    func start() async -> ScreenRecorder.StartResult { .started }

    func stop() async -> (url: URL, seconds: Int)? {
        let url = FileManager.default.temporaryDirectory.appending(path: "feedback-\(UUID().uuidString).mp4")
        guard (try? Data("fake".utf8).write(to: url)) != nil else { return nil }
        return (url, 3)
    }
}

extension FeedbackCenter {
    /// Opens what `-beytFeedback` asked for, once the first screen has appeared.
    func debugOpen(_ what: FeedbackLaunchOptions.Open) async {
        try? await Task.sleep(for: .seconds(1))
        switch what {
        case .shake: open(source: .shake)
        case .type(let type): open(source: .shake, type: type)
        case .recording: debugShowRecordingPill()
        }
    }
}
#endif
