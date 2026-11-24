import Foundation
import Observation
import UIKit

/// Where the feedback screens come from and go to. The real one presents a sheet over the topmost screen; tests use
/// one that does nothing.
@MainActor
protocol FeedbackPresenting: AnyObject {
    /// Shows the sheet for the center's current stage (the choices, or the form of the chosen type).
    func present(_ center: FeedbackCenter)
    /// The sheet goes from the choices to the full form.
    func expandToForm()
    func dismiss() async
}

/// The switch «تکون دادن برای بازخورد» in the settings.
enum FeedbackSettings {
    static let shakeKey = "feedback.shake"

    static func shakeEnabled(in defaults: UserDefaults = .standard) -> Bool {
        defaults.object(forKey: shakeKey) as? Bool ?? true
    }
}

/// The feedback flow of the app: shake or the settings row opens the sheet over the current screen, the person picks a
/// type and writes, a bug may be recorded in between, and the report is sent. One report is open at a time.
@MainActor @Observable
final class FeedbackCenter {
    enum Source { case shake, settings }
    enum Stage { case choices, form }

    static let recordingNote = "فیلم ضبط نشد؛ دوباره امتحان کن"

    private(set) var snapshot: FeedbackSnapshot?
    private(set) var model: FeedbackModel?
    /// The little message over the app after sending («رسید، ممنون!»).
    private(set) var toast: String?
    private(set) var isRecording = false
    /// ReplayKit said no, or cannot record here: the bug screen hides the option.
    private(set) var recordingRefused = false

    @ObservationIgnored private let app: AppModel
    @ObservationIgnored private let text: TextSettingsStore
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let log: FeedbackLog
    @ObservationIgnored private let capture: () -> UIImage?
    @ObservationIgnored private let recorder: ScreenRecorder
    @ObservationIgnored private let network: () -> NetworkKind
    @ObservationIgnored private let device: () -> DeviceInfo
    @ObservationIgnored var presenter: (any FeedbackPresenting)?
    @ObservationIgnored private var toastTask: Task<Void, Never>?
    @ObservationIgnored private var recordingTask: Task<Void, Never>?
    @ObservationIgnored private let overlay = FeedbackOverlay()

    init(
        app: AppModel, text: TextSettingsStore, session: Session, defaults: UserDefaults = .standard, log: FeedbackLog = .shared,
        capture: @escaping () -> UIImage? = { ScreenshotCapture.keyWindow() }, recorder: ScreenRecorder = ScreenRecorder(),
        network: @escaping () -> NetworkKind = { NetworkMonitor.shared.current }, device: @escaping () -> DeviceInfo = { DeviceInfo.current() }
    ) {
        self.app = app
        self.text = text
        self.session = session
        self.defaults = defaults
        self.log = log
        self.capture = capture
        self.recorder = recorder
        self.network = network
        self.device = device
    }

    var stage: Stage { model == nil ? .choices : .form }
    var isOpen: Bool { snapshot != nil }
    var recordingAvailable: Bool { !recordingRefused && recorder.isAvailable }

    // MARK: Opening

    /// The phone was shaken. Nothing happens when the shake is switched off in the settings.
    @discardableResult func shake() -> Bool {
        guard FeedbackSettings.shakeEnabled(in: defaults) else { return false }
        return open(source: .shake)
    }

    /// Takes the screenshot and the state of the moment, then opens the sheet (straight at the form of `type` when
    /// given). Not while a sheet or a recording is on.
    @discardableResult func open(source: Source, type: FeedbackType? = nil) -> Bool {
        guard !isOpen, !isRecording else { return false }
        let snapshot = FeedbackSnapshot(screenshot: capture(), info: makeInfo(), device: device(), fromShake: source == .shake)
        self.snapshot = snapshot
        model = type.map { makeModel($0, snapshot) }
        presenter?.present(self)
        return true
    }

    private func makeModel(_ type: FeedbackType, _ snapshot: FeedbackSnapshot) -> FeedbackModel {
        FeedbackModel(type: type, snapshot: snapshot, sender: FeedbackSender(session: session, log: log))
    }

    private func makeInfo() -> TechnicalInfo {
        let reader = app.reader == nil ? nil : log.reader
        let position = reader?.player?.position ?? 0
        return TechnicalInfo(
            screen: app.currentScreen,
            couplet: reader.flatMap { TechnicalInfo.coupletKey(path: $0.path, index: $0.actionIndex) },
            mode: reader?.mode.technicalTitle,
            recitationPosition: position > 0 ? (position * 10).rounded() / 10 : nil,
            textSettings: text.settings.technicalValues,
            network: network(),
            accountState: session.isSignedIn ? .signedIn : .guest,
            recentErrors: log.errors,
            steps: log.steps
        )
    }

    /// A type was picked on the sheet.
    func choose(_ type: FeedbackType) {
        guard let snapshot, model == nil else { return }
        model = makeModel(type, snapshot)
        presenter?.expandToForm()
    }

    // MARK: Closing and sending

    /// The × (or a swipe down on the choices): the draft is dropped.
    func close() async {
        await presenter?.dismiss()
        discard()
    }

    /// The system closed the sheet by itself (a swipe on the choices).
    func dismissedBySwipe() {
        discard()
    }

    private func discard() {
        model?.removeRecording()
        model = nil
        snapshot = nil
    }

    func send() async {
        guard let model else { return }
        await model.send()
        guard model.phase == .sent else { return }
        await close()
        showToast(FeedbackSender.thanks)
    }

    func showToast(_ line: String) {
        toast = line
        overlay.showToast(for: self)
        toastTask?.cancel()
        toastTask = Task {
            try? await Task.sleep(for: .seconds(2.5))
            if !Task.isCancelled { toast = nil }
        }
    }

    // MARK: Recording

    /// «دوباره انجامش بده، ما فیلم می‌گیریم»: the sheet goes away, the recording starts, the pill shows.
    func startRecording() async {
        guard let model, model.type.takesRecording, !isRecording else { return }
        model.removeRecording()
        await presenter?.dismiss()
        switch await recorder.start() {
        case .started:
            beginRecordingState()
        case .denied, .failed:
            recordingRefused = true
            presenter?.present(self)
        }
    }

    /// «تموم» on the pill (or the 60-second limit): the recording is kept and the bug screen comes back.
    func stopRecording() async {
        guard isRecording else { return }
        recordingTask?.cancel()
        isRecording = false
        overlay.hidePill()
        let clip = await recorder.stop()
        model?.recording = clip.map { FeedbackModel.Recording(url: $0.url, seconds: $0.seconds) }
        if isOpen { presenter?.present(self) }
        if clip == nil { showToast(Self.recordingNote) }
    }

    private func beginRecordingState() {
        isRecording = true
        overlay.showPill(for: self)
        recordingTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(RecordingBudget.maxSeconds))
            if !Task.isCancelled { await self?.stopRecording() }
        }
    }

    #if DEBUG
    /// Debug launch (`-beytFeedback recording`): the pill, without recording anything.
    func debugShowRecordingPill() {
        isRecording = true
        overlay.showPill(for: self)
    }
    #endif
}
