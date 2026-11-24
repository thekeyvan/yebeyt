import Foundation
import Observation
import UIKit

/// What the phone knew at the moment the person asked to give feedback, before the sheet opened: the screenshot, the
/// state for a bug report and the device. It stays in memory only.
struct FeedbackSnapshot {
    var screenshot: UIImage?
    var info: TechnicalInfo
    var device: DeviceInfo
    /// The shake opened it (the sheet says so); the «بازخورد» row in the settings did not.
    var fromShake: Bool
}

/// One report being written: the draft, the screenshot (and its marks), the recording and how sending went.
@MainActor @Observable
final class FeedbackModel {
    struct Recording: Equatable {
        var url: URL
        var seconds: Int
    }

    enum Phase: Equatable {
        case editing
        case sending
        /// The line to show; the button is still there.
        case failed(String)
        case sent
    }

    let snapshot: FeedbackSnapshot
    var draft: FeedbackDraft
    /// The screenshot with the person's marks, once the editor was used.
    var edited: UIImage?
    var recording: Recording?
    var technicalOpen = false
    private(set) var phase = Phase.editing
    @ObservationIgnored private let sender: FeedbackSender

    init(type: FeedbackType, snapshot: FeedbackSnapshot, sender: FeedbackSender) {
        self.snapshot = snapshot
        self.sender = sender
        draft = FeedbackDraft(type: type)
    }

    var type: FeedbackType { draft.type }
    var image: UIImage? { edited ?? snapshot.screenshot }
    var canSend: Bool { draft.canSend && phase != .sending }
    var failure: String? { if case .failed(let line) = phase { line } else { nil } }

    /// The report has reached the server (only a file failed): what was written can no longer change.
    var isLocked: Bool { phase == .sending || sender.hasCreatedReport }

    func send() async {
        guard canSend else { return }
        phase = .sending
        var files = FeedbackSender.Files()
        if draft.sendsScreenshot, let image { files.screenshot = ScreenshotEncoder.jpeg(from: image) }
        if type.takesRecording { files.recording = recording?.url }
        let payload = FeedbackPayload(draft: draft, info: snapshot.info, device: snapshot.device)
        switch await sender.send(payload, files: files) {
        case .sent: phase = .sent
        case .failed(let line): phase = .failed(line)
        }
    }

    func removeRecording() {
        if let recording { try? FileManager.default.removeItem(at: recording.url) }
        recording = nil
    }
}
