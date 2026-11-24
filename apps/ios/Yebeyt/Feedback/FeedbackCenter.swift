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

/// The question before a report with something written is closed (docs/yebeyt-2.md, «Asking before it hurts»).
enum FeedbackCopy {
    static let title = "بازخوردت هنوز فرستاده نشده. ولش کنی؟"
    static let discard = "ول کن"
    static let stay = "بمون"
    /// The report is on the server and only a file did not go (it can still be sent again).
    static let filesTitle = "فیلم یا عکست فرستاده نشده. ولش کنی؟"
    /// «حذف فیلم»: the recording can't be brought back.
    static let recordingTitle = "فیلم پاک بشه؟"
    static let recordingDelete = "پاک کن"
    static let recordingKeep = "نه"
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
    /// The question «بازخوردت هنوز فرستاده نشده. ولش کنی؟» is on screen.
    var isConfirmingClose = false
    /// ReplayKit said no, or cannot record here: the bug screen hides the option.
    private(set) var recordingRefused = false

    @ObservationIgnored private let app: AppModel
    @ObservationIgnored private let text: TextSettingsStore
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let log: FeedbackLog
    @ObservationIgnored private let capture: () -> UIImage?
    @ObservationIgnored private let recorder: any ScreenRecording
    @ObservationIgnored private let isEditingText: () -> Bool
    @ObservationIgnored private let network: () -> NetworkKind
    @ObservationIgnored private let device: () -> DeviceInfo
    @ObservationIgnored var presenter: (any FeedbackPresenting)?
    @ObservationIgnored private var toastTask: Task<Void, Never>?
    @ObservationIgnored private var recordingTask: Task<Void, Never>?
    @ObservationIgnored private let overlay = FeedbackOverlay()

    init(
        app: AppModel, text: TextSettingsStore, session: Session, defaults: UserDefaults = .standard, log: FeedbackLog = .shared,
        capture: @escaping () -> UIImage? = { ScreenshotCapture.keyWindow() }, recorder: any ScreenRecording = ScreenRecorder(),
        isEditingText: @escaping () -> Bool = { FeedbackCenter.textFieldHasFocus() },
        network: @escaping () -> NetworkKind = { NetworkMonitor.shared.current }, device: @escaping () -> DeviceInfo = { DeviceInfo.current() }
    ) {
        self.app = app
        self.text = text
        self.session = session
        self.defaults = defaults
        self.log = log
        self.capture = capture
        self.recorder = recorder
        self.isEditingText = isEditingText
        self.network = network
        self.device = device
    }

    var stage: Stage { model == nil ? .choices : .form }
    var isOpen: Bool { snapshot != nil }
    var recordingAvailable: Bool { !recordingRefused && recorder.isAvailable }

    // MARK: Opening

    /// The phone was shaken. Nothing happens when the shake is switched off in the settings, or while a text field has
    /// the focus (shaking the phone then undoes typing).
    @discardableResult func shake() -> Bool {
        guard FeedbackSettings.shakeEnabled(in: defaults), !isEditingText() else { return false }
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

    /// A text field or text view in the key window is being edited.
    static func textFieldHasFocus() -> Bool {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let window = scenes.flatMap(\.windows).first(where: \.isKeyWindow) else { return false }
        func editing(_ view: UIView) -> Bool {
            (view.isFirstResponder && view is UITextInput) || view.subviews.contains(where: editing)
        }
        return editing(window)
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

    /// What the question before closing says: the draft, or (when the report already reached the server) the files.
    var closeQuestion: String { model?.reportReachedServer == true ? FeedbackCopy.filesTitle : FeedbackCopy.title }

    /// The × or a swipe down: closes at once when nothing is written, otherwise asks first. «بمون» just closes the question
    /// (the sheet's binding), and the form is as it was.
    func requestClose() async {
        guard model?.hasUnsentWork == true else { return await close() }
        // The keyboard goes first, so it doesn't come and go under the question.
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        isConfirmingClose = true
    }

    /// The draft is dropped and the sheet goes.
    func close() async {
        await presenter?.dismiss()
        discard()
    }

    /// The system closed the sheet by itself (a swipe on the choices).
    func dismissedBySwipe() {
        discard()
    }

    private func discard() {
        isConfirmingClose = false
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
        UIAccessibility.post(notification: .announcement, argument: line)
        toastTask?.cancel()
        toastTask = Task {
            try? await Task.sleep(for: .seconds(2.5))
            guard !Task.isCancelled else { return }
            toast = nil
            overlay.hideToast()
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
        case .denied:
            recordingRefused = true
            presenter?.present(self)
        case .failed:
            presenter?.present(self)
            showToast(Self.recordingNote)
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
        UIAccessibility.post(notification: .announcement, argument: "در حال ضبط")
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
