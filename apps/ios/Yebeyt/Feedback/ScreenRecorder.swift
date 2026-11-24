@preconcurrency import AVFoundation
import Foundation
@preconcurrency import ReplayKit

/// How big a recording may get: at most 60 seconds, under the server's 25 MB.
enum RecordingBudget {
    static let maxSeconds = 60
    static let maxBytes = 25_000_000
    static let longSide = 1280

    /// Bits per second that keep a full-length recording at 80% of the size limit, and never above 2.5 Mbit.
    static func bitrate(seconds: Int = maxSeconds, bytes: Int = maxBytes) -> Int {
        min(2_500_000, bytes * 8 * 8 / 10 / max(seconds, 1))
    }

    /// The picture size of the video: the screen scaled down to 1280 on its long side, both sides even (H.264).
    static func videoSize(width: Int, height: Int) -> (width: Int, height: Int) {
        let shrink = min(1, Double(longSide) / Double(max(width, height, 1)))
        func even(_ value: Double) -> Int { max(2, Int(value.rounded()) / 2 * 2) }
        return (even(Double(width) * shrink), even(Double(height) * shrink))
    }
}

/// Writes the frames ReplayKit hands over into an H.264 MP4, without sound. ReplayKit calls `append` from its own
/// queue, so the state is behind a lock.
final class RecordingWriter: @unchecked Sendable {
    private let url: URL
    private let lock = NSLock()
    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private var first: CMTime?
    private var last: CMTime?

    init(url: URL) { self.url = url }

    func append(_ buffer: CMSampleBuffer) {
        lock.withLock {
            guard CMSampleBufferIsValid(buffer), CMSampleBufferDataIsReady(buffer), let pixels = CMSampleBufferGetImageBuffer(buffer) else { return }
            let time = CMSampleBufferGetPresentationTimeStamp(buffer)
            if writer == nil, !start(width: CVPixelBufferGetWidth(pixels), height: CVPixelBufferGetHeight(pixels), at: time) { return }
            guard let writer, let input, writer.status == .writing, input.isReadyForMoreMediaData else { return }
            if input.append(buffer) {
                if first == nil { first = time }
                last = time
            }
        }
    }

    private func start(width: Int, height: Int, at time: CMTime) -> Bool {
        let size = RecordingBudget.videoSize(width: width, height: height)
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: size.width,
            AVVideoHeightKey: size.height,
            AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: RecordingBudget.bitrate(), AVVideoExpectedSourceFrameRateKey: 30],
        ]
        guard let writer = try? AVAssetWriter(outputURL: url, fileType: .mp4) else { return false }
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else { return false }
        writer.add(input)
        guard writer.startWriting() else { return false }
        writer.startSession(atSourceTime: time)
        self.writer = writer
        self.input = input
        return true
    }

    /// The finished file and its length in seconds, or nil when no frame arrived or the file is over the limit.
    func finish() async -> (url: URL, seconds: Int)? {
        let (writer, input, seconds) = lock.withLock { (self.writer, self.input, (first != nil && last != nil) ? CMTimeGetSeconds(last! - first!) : 0) }
        guard let writer, let input, writer.status == .writing else { return nil }
        input.markAsFinished()
        await writer.finishWriting()
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? .max
        guard writer.status == .completed, size <= RecordingBudget.maxBytes else {
            try? FileManager.default.removeItem(at: url)
            return nil
        }
        return (url, max(1, Int(seconds.rounded())))
    }
}

/// ReplayKit's in-app recording of the app's own screen. No microphone.
@MainActor
final class ScreenRecorder {
    enum StartResult { case started, denied, failed }

    private var writer: RecordingWriter?

    var isAvailable: Bool { RPScreenRecorder.shared().isAvailable }

    /// Asks the system's permission (the first time) and starts. `denied` is the person saying no.
    func start() async -> StartResult {
        let recorder = RPScreenRecorder.shared()
        recorder.isMicrophoneEnabled = false
        let url = FileManager.default.temporaryDirectory.appending(path: "feedback-\(UUID().uuidString).mp4")
        let writer = RecordingWriter(url: url)
        do {
            try await recorder.startCapture { @Sendable buffer, type, _ in
                if type == .video { writer.append(buffer) }
            }
        } catch {
            return (error as NSError).code == RPRecordingErrorCode.userDeclined.rawValue ? .denied : .failed
        }
        self.writer = writer
        return .started
    }

    /// Stops and answers the file, or nil when nothing usable was recorded.
    func stop() async -> (url: URL, seconds: Int)? {
        guard let writer else { return nil }
        self.writer = nil
        try? await RPScreenRecorder.shared().stopCapture()
        return await writer.finish()
    }
}
