import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct ScoreSyncTests {
    private func sync(_ env: SignedInStub, now: Date = Date(timeIntervalSince1970: 1_800_000_000)) -> ScoreSync {
        ScoreSync(session: env.session, defaults: env.defaults, now: { now })
    }

    @Test func theCapsAreTheServers() {
        #expect(ScoreGame.allCases.map { "\($0.rawValue)=\($0.cap)" } == [
            "daily=100", "jigsaw=320", "poet=440", "second=440", "book=440", "match=50", "listen=100", "onboarding=50",
        ])
        #expect(ScoreGame(.misra) == .second)
        #expect(ScoreGame(.mosh) == nil && ScoreGame(.duel) == nil)
        #expect(ScoreGame.match.clipped(75) == 50)
        #expect(ScoreGame.match.clipped(-3) == 0)
    }

    @Test func aFinishedRoundIsSentWithItsOwnRoundId() async throws {
        let env = SignedInStub()
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.poet, points: 260)
        await scores.flush()
        let call = try #require(env.stub.requests(to: "/v1/scores").first)
        #expect(call.method == "POST")
        #expect(call.authorization == "Bearer a1")
        #expect(call.json["game"] as? String == "poet")
        #expect(call.json["points"] as? Int == 260)
        #expect(UUID(uuidString: call.json["roundId"] as? String ?? "") != nil)
        #expect(call.json["playedAt"] as? String == "2027-01-15T08:00:00.000Z")
        #expect(!scores.hasUnsent)
    }

    @Test func pointsOverTheCapAreClippedBeforeSending() async throws {
        let env = SignedInStub()
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.match, points: 90)
        await scores.flush()
        #expect(env.stub.requests(to: "/v1/scores").first?.json["points"] as? Int == 50)
    }

    @Test func aRoundOfNothingIsNotSent() async {
        let env = SignedInStub()
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.jigsaw, points: 0)
        await scores.flush()
        #expect(env.stub.requests(to: "/v1/scores").isEmpty && !scores.hasUnsent)
    }

    @Test func aRoundWaitsOnDiskWhileOfflineAndGoesOnTheNextFlushWithTheSameRoundId() async throws {
        let env = SignedInStub { _ in .offline }
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.jigsaw, points: 120)
        await scores.flush()
        #expect(scores.hasUnsent)
        let first = try #require(env.stub.requests(to: "/v1/scores").first?.json["roundId"] as? String)

        // A restart finds it on disk.
        let reopened = sync(env)
        #expect(reopened.hasUnsent)
        env.respond { _ in .json(200, #"{"week":"2027-W02","weekPoints":120}"#) }
        await reopened.flush()
        #expect(!reopened.hasUnsent)
        let last = try #require(env.stub.requests(to: "/v1/scores").last)
        #expect(last.json["roundId"] as? String == first)
        #expect(env.stub.requests(to: "/v1/scores").count == 2)
    }

    @Test func aServerErrorKeepsTheRoundForALaterRetryButARefusalDropsIt() async {
        let env = SignedInStub { _ in .json(503, #"{"error":"unavailable"}"#) }
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.listen, points: 60)
        await scores.flush()
        #expect(scores.hasUnsent)
        env.respond { _ in .json(429, #"{"error":"rate_limited"}"#) }
        await scores.flush()
        #expect(scores.hasUnsent)
        env.respond { _ in .json(400, #"{"error":"bad_timestamp"}"#) }  // too old now: it will never be taken
        await scores.flush()
        #expect(!scores.hasUnsent)
    }

    @Test func aConflictCountsAsDone() async {
        let env = SignedInStub { _ in .json(409, #"{"error":"conflict"}"#) }
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.daily, points: 100)
        await scores.flush()
        #expect(!scores.hasUnsent)
        #expect(env.stub.requests(to: "/v1/scores").count == 1)
    }

    @Test func roundsGoInTheOrderTheyWereFinishedAndAFailureStopsTheRest() async {
        let env = SignedInStub { _ in .offline }
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.poet, points: 20)
        scores.report(.book, points: 40)
        await scores.flush()
        #expect(env.stub.requests(to: "/v1/scores").count == 1)  // the second waited behind the first
        env.respond { _ in .json(200, "{}") }
        await scores.flush()
        #expect(env.stub.requests(to: "/v1/scores").suffix(2).map { $0.json["game"] as? String } == ["poet", "book"])
        #expect(!scores.hasUnsent)
    }

    @Test func theDailyResultIsReportedWithItsDayAndItsPoints() async throws {
        let env = SignedInStub()
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.reportDaily(on: TehranDay(key: "2026-11-23")!, solved: true, tries: 2, points: 70)
        await scores.flush()
        let daily = try #require(env.stub.requests(to: "/v1/daily").first)
        #expect(daily.json["date"] as? String == "2026-11-23")
        #expect(daily.json["solved"] as? Bool == true)
        #expect(daily.json["tries"] as? Int == 2)
        #expect(env.stub.requests(to: "/v1/scores").first?.json["game"] as? String == "daily")
        #expect(env.stub.requests(to: "/v1/scores").first?.json["points"] as? Int == 70)
    }

    @Test func aFailedDailyReportsTheResultWithoutPoints() async {
        let env = SignedInStub()
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.reportDaily(on: TehranDay(key: "2026-11-23")!, solved: false, tries: 3, points: 0)
        await scores.flush()
        #expect(env.stub.requests(to: "/v1/daily").first?.json["solved"] as? Bool == false)
        #expect(env.stub.requests(to: "/v1/scores").isEmpty)
    }

    @Test func aGuestsRoundsAreNotKeptButTheOnboardingRoundWaitsForTheSignIn() async {
        let env = SignedInStub(signedIn: false)
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.poet, points: 100)
        #expect(!scores.hasUnsent)
        scores.report(.onboarding, points: 50, keepWhileSignedOut: true)
        await scores.flush()
        #expect(scores.hasUnsent)
        #expect(env.stub.requests(to: "/v1/scores").isEmpty)
        // The sign-in lands: the round goes up.
        env.keychain.write("r0")
        let signedIn = ScoreSync(session: Session(api: env.stub.api, store: env.keychain), defaults: env.defaults)
        await signedIn.flush()
        #expect(!signedIn.hasUnsent)
        #expect(env.stub.requests(to: "/v1/scores").first?.json["game"] as? String == "onboarding")
    }

    @Test func clearingForgetsWhatWasWaiting() async {
        let env = SignedInStub { _ in .offline }
        defer { env.cleanUp() }
        let scores = sync(env)
        scores.report(.poet, points: 20)
        await scores.flush()
        scores.clear()
        #expect(!scores.hasUnsent && !sync(env).hasUnsent)
    }

    // MARK: What tells it

    @Test func theDailyPuzzleTellsOnceWhenItIsOverAndNotWhileItIsBeingPlayed() {
        let stats = GameStats(defaults: UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!)
        var told: [String] = []
        stats.finishedDailyHandler = { day, solved, tries, points in told.append("\(day.key) \(solved) \(tries) \(points)") }
        let day = TehranDay(key: "2026-11-23")!
        stats.record(DailyRecord(tries: ["a"], hinted: [], outcome: .playing, points: 0), on: day)
        #expect(told.isEmpty)
        stats.record(DailyRecord(tries: ["a", "b"], hinted: [], outcome: .solved, points: 70), on: day)
        stats.record(DailyRecord(tries: ["a", "b"], hinted: [], outcome: .solved, points: 70), on: day)
        #expect(told == ["2026-11-23 true 2 70"])
        let other = TehranDay(key: "2026-11-24")!
        stats.record(DailyRecord(tries: ["a", "b", "c"], hinted: [], outcome: .failed, points: 0), on: other)
        #expect(told.last == "2026-11-24 false 3 0")
    }

    @Test func aRoundOfASoloGameTellsItsGameAndPoints() {
        let stats = GameStats(defaults: UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!)
        var told: [String] = []
        stats.finishedRoundHandler = { kind, points in told.append("\(kind.rawValue) \(points)") }
        stats.finishRound(of: .misra, points: 88)
        #expect(told == ["misra 88"])
    }
}
