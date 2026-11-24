import Foundation
import Testing
import UIKit
@testable import Yebeyt

@MainActor
private final class RecordingPresenter: FeedbackPresenting {
    private(set) var presented = 0
    private(set) var expanded = 0
    private(set) var dismissed = 0
    func present(_ center: FeedbackCenter) { presented += 1 }
    func expandToForm() { expanded += 1 }
    func dismiss() async { dismissed += 1 }
}

@MainActor
struct FeedbackCenterTests {
    private struct Fixture {
        var center: FeedbackCenter
        var app: AppModel
        var presenter: RecordingPresenter
        var log: FeedbackLog
        var defaults: UserDefaults
        var stub: StubServer
    }

    private func fixture(network: NetworkKind = .wifi) -> Fixture {
        let defaults = UserDefaults(suiteName: "feedback.tests.\(UUID().uuidString)")!
        let stub = StubServer { _ in .json(201, #"{"id":"6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11","uploadToken":"t"}"#) }
        let app = AppModel()
        let log = FeedbackLog()
        let presenter = RecordingPresenter()
        let session = Session(api: stub.api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)"))
        let center = FeedbackCenter(
            app: app, text: TextSettingsStore(defaults: defaults), session: session, defaults: defaults, log: log,
            capture: { nil }, network: { network }, device: { DeviceInfo(appVersion: "2.0.0", deviceModel: "iPhone17,1", osVersion: "26.0") }
        )
        center.presenter = presenter
        return Fixture(center: center, app: app, presenter: presenter, log: log, defaults: defaults, stub: stub)
    }

    @Test func aShakeOpensTheSheetUnlessTheSettingSwitchesItOff() {
        let f = fixture()
        #expect(FeedbackSettings.shakeEnabled(in: f.defaults))  // on by default
        f.defaults.set(false, forKey: FeedbackSettings.shakeKey)
        #expect(!f.center.shake())
        #expect(!f.center.isOpen)
        #expect(f.presenter.presented == 0)
        f.defaults.set(true, forKey: FeedbackSettings.shakeKey)
        #expect(f.center.shake())
        #expect(f.center.isOpen)
        #expect(f.presenter.presented == 1)
        #expect(f.center.snapshot?.fromShake == true)
    }

    @Test func aShakeOfTheWindowIsAnnouncedToTheApp() async {
        var heard = 0
        let token = NotificationCenter.default.addObserver(forName: .deviceDidShake, object: nil, queue: nil) { _ in heard += 1 }
        defer { NotificationCenter.default.removeObserver(token) }
        let window = UIWindow()
        window.motionEnded(.motionShake, with: nil)
        window.motionEnded(.none, with: nil)  // not a shake
        #expect(heard == 1)
    }

    @Test func theSettingsRowOpensTheSameSheetEvenWithShakeOff() {
        let f = fixture()
        f.defaults.set(false, forKey: FeedbackSettings.shakeKey)
        #expect(f.center.open(source: .settings))
        #expect(f.center.snapshot?.fromShake == false)
    }

    @Test func aSecondShakeWhileTheSheetIsOpenDoesNothing() {
        let f = fixture()
        #expect(f.center.shake())
        #expect(!f.center.shake())
        #expect(f.presenter.presented == 1)
    }

    @Test func pickingATypeStartsItsDraftAndClosingDropsIt() async {
        let f = fixture()
        f.center.open(source: .shake)
        #expect(f.center.stage == .choices)
        f.center.choose(.idea)
        #expect(f.center.stage == .form)
        #expect(f.center.model?.draft.screenshotOn == false)
        #expect(f.presenter.expanded == 1)
        await f.center.close()
        #expect(f.center.model == nil && !f.center.isOpen)
        #expect(f.presenter.dismissed == 1)
        #expect(f.center.shake())  // and it can open again
    }

    @Test func theSnapshotHasTheStateOfTheMomentBeforeTheSheet() {
        let f = fixture(network: .cellular)
        f.app.select(.me)
        f.app.mePath = [.settings]
        f.log.visit(.home)
        f.log.visit(.settings)
        f.log.record(.network)
        f.center.open(source: .shake)
        let info = f.center.snapshot?.info
        #expect(info?.screen == .settings)
        #expect(info?.network == .cellular)
        #expect(info?.accountState == .guest)
        #expect(info?.steps == [.home, .settings])
        #expect(info?.recentErrors == ["network"])
        #expect(info?.couplet == nil && info?.mode == nil && info?.recitationPosition == nil)
        #expect(info?.textSettings.count == 6)
        #expect(f.center.snapshot?.device.deviceModel == "iPhone17,1")
    }

    @Test func anOpenReaderAddsTheCoupletAndTheMode() {
        let f = fixture()
        let route = ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 2)
        let reader = ReaderModel(route: route)
        f.log.reader = reader
        f.app.openReader(route)
        f.center.open(source: .shake)
        let info = f.center.snapshot?.info
        #expect(info?.screen == .reader)
        #expect(info?.couplet == "/hafez/ghazal/sh3#2")
        #expect(info?.mode == "بیت به بیت")
        f.app.closeReader()
        #expect(f.center.snapshot != nil)
    }

    @Test func aReaderThatIsClosedIsNotReported() async {
        let f = fixture()
        f.log.reader = ReaderModel(route: ReaderRoute(path: "/hafez/ghazal/sh3"))  // left over, the app has no reader open
        f.center.open(source: .shake)
        #expect(f.center.snapshot?.info.couplet == nil)
    }

    @Test func sendingAReportClosesTheSheetAndThanks() async throws {
        let f = fixture()
        f.center.open(source: .shake)
        f.center.choose(.liked)
        let model = try #require(f.center.model)
        #expect(!model.canSend)
        await f.center.send()  // nothing written: nothing sent
        #expect(f.stub.requests.isEmpty)
        model.draft.text = "خیلی خوبه"
        await f.center.send()
        #expect(f.center.toast == "رسید، ممنون!")
        #expect(!f.center.isOpen)
        let body = try #require(f.stub.requests.first?.json)
        #expect(body["type"] as? String == "liked")
        #expect(body["text"] as? String == "خیلی خوبه")
    }

    @Test func aFailedSendKeepsTheSheetTheDraftAndTheButton() async throws {
        let f = fixture()
        f.stub.respond { _ in .offline }
        f.center.open(source: .shake)
        f.center.choose(.idea)
        let model = try #require(f.center.model)
        model.draft.text = "ایده"
        await f.center.send()
        #expect(model.failure == FeedbackSender.offlineLine)
        #expect(f.center.isOpen && f.center.toast == nil)
        #expect(model.canSend)
        #expect(!model.isLocked)  // nothing reached the server yet: still editable
        f.stub.respond { _ in .json(201, #"{"id":"6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11","uploadToken":"t"}"#) }
        await f.center.send()
        #expect(f.center.toast == "رسید، ممنون!")
    }

    @Test func aRemovedRecordingDeletesItsFile() throws {
        let f = fixture()
        f.center.open(source: .shake, type: .bug)
        let model = try #require(f.center.model)
        let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).mp4")
        try Data([1]).write(to: url)
        model.recording = FeedbackModel.Recording(url: url, seconds: 12)
        model.removeRecording()
        #expect(model.recording == nil)
        #expect(!FileManager.default.fileExists(atPath: url.path))
    }

    @Test func theRecordingFitsTheLimitsByDesign() {
        #expect(RecordingBudget.maxSeconds == 60)
        #expect(RecordingBudget.bitrate() * RecordingBudget.maxSeconds / 8 <= RecordingBudget.maxBytes)  // a full recording fits
        #expect(RecordingBudget.bitrate(seconds: 60, bytes: 5_000_000) < RecordingBudget.bitrate())  // a smaller budget lowers the rate
        let size = RecordingBudget.videoSize(width: 1206, height: 2622)
        #expect(max(size.width, size.height) <= RecordingBudget.longSide)
        #expect(size.width % 2 == 0 && size.height % 2 == 0)
        let small = RecordingBudget.videoSize(width: 390, height: 844)
        #expect(small.width == 390 && small.height == 844)  // never enlarged
    }
}
