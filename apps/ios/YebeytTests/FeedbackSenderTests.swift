import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct FeedbackSenderTests {
    private let device = DeviceInfo(appVersion: "2.0.0", deviceModel: "iPhone17,1", osVersion: "26.0")
    private let info = TechnicalInfo(screen: .home, textSettings: [:], network: .wifi, accountState: .guest, recentErrors: [], steps: [])

    private func payload(_ type: FeedbackType = .bug) -> FeedbackPayload {
        var draft = FeedbackDraft(type: type)
        draft.text = "نوشته"
        return FeedbackPayload(draft: draft, info: info, device: device)
    }

    private func store() -> KeychainStore { KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)") }

    private func recordingFile() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).mp4")
        try Data([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]).write(to: url)
        return url
    }

    private let created = #"{"id":"6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11","uploadToken":"tok-1"}"#
    private let reportPath = "/v1/feedback"
    private let screenshotPath = "/v1/feedback/6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11/screenshot"
    private let recordingPath = "/v1/feedback/6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11/recording"

    @Test func aGuestsReportGoesWithoutASessionThenTheFilesGoWithTheToken() async throws {
        let stub = StubServer { request in
            request.method == "POST" ? .json(201, self.created) : .json(204, "")
        }
        let sender = FeedbackSender(session: Session(api: stub.api, store: store()), log: FeedbackLog())
        let video = try recordingFile()
        let outcome = await sender.send(payload(), files: .init(screenshot: Data([0xFF, 0xD8, 0xFF, 1]), recording: video))
        #expect(outcome == .sent)
        #expect(stub.requests.map { "\($0.method) \($0.path)" } == ["POST \(reportPath)", "PUT \(screenshotPath)", "PUT \(recordingPath)"])  // in this order
        #expect(stub.requests[0].authorization == nil)
        #expect(stub.requests[1].headers["x-upload-token"] == "tok-1")
        #expect(stub.requests[1].headers["content-type"] == "image/jpeg")
        #expect(stub.requests[1].body == Data([0xFF, 0xD8, 0xFF, 1]))
        #expect(stub.requests[2].headers["x-upload-token"] == "tok-1")
        #expect(stub.requests[2].headers["content-type"] == "video/mp4")
        #expect(stub.requests[2].body.count == 8)
    }

    @Test func aSignedInPersonsReportCarriesTheSession() async throws {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { request in
            switch request.path {
            case "/v1/auth/refresh": .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "ali"))
            case self.reportPath: .json(201, self.created)
            default: .json(204, "")
            }
        }
        let session = Session(api: stub.api, store: keychain)
        let sender = FeedbackSender(session: session, log: FeedbackLog())
        #expect(await sender.send(payload(.idea), files: .init()) == .sent)
        #expect(stub.requests(to: reportPath).first?.authorization == "Bearer a1")
    }

    @Test func aRefusedSessionFallsBackToAGuestsReport() async throws {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { request in
            switch request.path {
            case "/v1/auth/refresh": StubJSON.unauthorized
            case self.reportPath: .json(201, self.created)
            default: .json(204, "")
            }
        }
        let sender = FeedbackSender(session: Session(api: stub.api, store: keychain), log: FeedbackLog())
        #expect(await sender.send(payload(), files: .init()) == .sent)
        #expect(stub.requests(to: reportPath).first?.authorization == nil)
    }

    @Test func aBusyServerIsAskedAgainOnceAfterRetryAfter() async throws {
        let stub = StubServer()
        let uploads = Counter()
        stub.respond { request in
            if request.method == "POST" { return .json(201, self.created) }
            return uploads.next() == 1 ? .jsonWithHeaders(503, #"{"error":"busy"}"#, ["Retry-After": "4"]) : .json(204, "")
        }
        let waits = Counter()
        let sender = FeedbackSender(session: Session(api: stub.api, store: store()), log: FeedbackLog(), pause: { waits.add($0) })
        #expect(await sender.send(payload(), files: .init(screenshot: Data([1]))) == .sent)
        #expect(stub.requests(to: screenshotPath).count == 2)
        #expect(waits.total == 4)
        #expect(stub.requests(to: reportPath).count == 1)
    }

    @Test func aServerThatStaysBusyFailsAndSendingAgainDoesNotMakeASecondReport() async throws {
        let stub = StubServer()
        let busy = Flag(true)
        stub.respond { request in
            if request.method == "POST" { return .json(201, self.created) }
            return busy.value ? .jsonWithHeaders(503, #"{"error":"busy"}"#, ["Retry-After": "1"]) : .json(204, "")
        }
        let sender = FeedbackSender(session: Session(api: stub.api, store: store()), log: FeedbackLog(), pause: { _ in })
        let files = FeedbackSender.Files(screenshot: Data([1]))
        #expect(await sender.send(payload(), files: files) == .failed(FeedbackSender.busyLine))
        #expect(sender.hasCreatedReport)
        busy.value = false
        #expect(await sender.send(payload(), files: files) == .sent)
        #expect(stub.requests(to: reportPath).count == 1)  // the same report
        #expect(stub.requests(to: screenshotPath).count == 3)
    }

    @Test func offlineKeepsTheDraftWithTheOfflineLineAndSendingLaterWorks() async throws {
        let stub = StubServer { _ in .offline }
        let log = FeedbackLog()
        let sender = FeedbackSender(session: Session(api: stub.api, store: store()), log: log)
        #expect(await sender.send(payload(), files: .init()) == .failed("الان نرسید، وقتی اینترنت اومد دوباره بفرست"))
        #expect(!sender.hasCreatedReport)
        #expect(log.errors == ["network"])
        stub.respond { _ in .json(201, self.created) }
        #expect(await sender.send(payload(), files: .init()) == .sent)
    }

    @Test func tooManyReportsSaysToTryALittleLater() async throws {
        let stub = StubServer { _ in .json(429, #"{"error":"rate_limited"}"#) }
        let sender = FeedbackSender(session: Session(api: stub.api, store: store()), log: FeedbackLog())
        #expect(await sender.send(payload(), files: .init()) == .failed("یه کم بعد دوباره بفرست"))
    }

    @Test func otherFailuresShowTheGenericLineNeverACode() async throws {
        let stub = StubServer { _ in .json(500, #"{"error":"internal_error"}"#) }
        let sender = FeedbackSender(session: Session(api: stub.api, store: store()), log: FeedbackLog())
        #expect(await sender.send(payload(), files: .init()) == .failed(APIError.badResponse.persianMessage))
    }

    @Test func aFileTheServerWillNeverTakeDoesNotStopTheReport() async throws {
        let stub = StubServer { request in
            switch request.path {
            case self.reportPath: .json(201, self.created)
            case self.screenshotPath: .json(413, #"{"error":"payload_too_large"}"#)
            default: .json(409, #"{"error":"already_uploaded"}"#)
            }
        }
        let sender = FeedbackSender(session: Session(api: stub.api, store: store()), log: FeedbackLog())
        let video = try recordingFile()
        #expect(await sender.send(payload(), files: .init(screenshot: Data([1]), recording: video)) == .sent)
    }

    @Test func anUploadRateLimitAsksToTryLater() async throws {
        let stub = StubServer { request in
            request.method == "POST" ? .json(201, self.created) : .json(429, #"{"error":"rate_limited"}"#)
        }
        let sender = FeedbackSender(session: Session(api: stub.api, store: store()), log: FeedbackLog())
        #expect(await sender.send(payload(), files: .init(screenshot: Data([1]))) == .failed(FeedbackSender.rateLine))
    }
}

/// Small thread-safe helpers for the closures of the stub server.
private final class Counter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0
    private(set) var total = 0
    func next() -> Int { lock.withLock { count += 1; return count } }
    func add(_ value: Int) { lock.withLock { total += value } }
}

private final class Flag: @unchecked Sendable {
    private let lock = NSLock()
    private var stored: Bool
    init(_ value: Bool) { stored = value }
    var value: Bool {
        get { lock.withLock { stored } }
        set { lock.withLock { stored = newValue } }
    }
}
