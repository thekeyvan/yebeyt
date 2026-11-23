import Foundation
import Testing
@testable import Yebeyt

struct UsernameTests {
    /// The same cases as `apps/server/test/usernames.test.ts`: the phone and the server agree.
    @Test(arguments: [
        ("ali", nil), ("hafez_fan", nil), ("a.b.c", nil), ("user_123", nil), (String(repeating: "a", count: 20), nil),
        (String(repeating: "a", count: 21), .tooLong), ("ab", .tooShort), ("", .tooShort),
        ("1abc", .badChars), ("_abc", .badChars), (".abc", .badChars), ("ab..cd", .badChars), ("abc.", .badChars),
        ("ab cd", .badChars), ("علی_علی", .badChars), ("ab-cd", .badChars), ("ABC", .badChars),
        ("yebeyt", .reserved), ("admin", .reserved), ("support", .reserved),
    ] as [(String, UsernameRules.Problem?)])
    func theRulesMirrorTheServer(name: String, problem: UsernameRules.Problem?) {
        #expect(UsernameRules.problem(name) == problem)
    }

    @Test func namesAreTrimmedAndLowerCasedBeforeChecking() {
        #expect(UsernameRules.normalize("  Hafez_Fan ") == "hafez_fan")
        #expect(UsernameRules.problem(UsernameRules.normalize("ADMIN")) == .reserved)
    }

    @Test func everyProblemHasTheLeadsCopy() {
        #expect(UsernameRules.Problem.taken.message == "قبلاً گرفته شده")
        #expect(UsernameRules.Problem.tooShort.message == "حداقل ۳ حرف")
        #expect(UsernameRules.Problem.tooLong.message == "حداکثر ۲۰ حرف")
        #expect(UsernameRules.Problem.badChars.message == "فقط حروف انگلیسی، عدد، «_» و «.»")
        #expect(UsernameRules.Problem.reserved.message == "این اسم رزرو شده")
    }

    @Test func suggestionsStartFromTheLatinLettersOfTheName() {
        #expect(UsernameRules.suggestionBase(from: "Niloofar Sh") == "niloofarsh")
        #expect(UsernameRules.suggestionBase(from: "José 12") == "jose12")
        #expect(UsernameRules.suggestionBase(from: "42 Ali") == "ali")
        #expect(UsernameRules.suggestionBase(from: "نیلوفر") == "beyt")
        #expect(UsernameRules.suggestionBase(from: String(repeating: "a", count: 40)).count == 16)
    }

    @Test func theInviteLink() {
        #expect(InviteLink.display(username: "niloofar") == "yebeyt.com/i/niloofar")
        #expect(InviteLink.url(username: "niloofar") == "https://yebeyt.com/i/niloofar")
    }
}

/// Counts the questions asked of the server.
private final class Asked: @unchecked Sendable {
    private let lock = NSLock()
    private var names: [String] = []
    func record(_ name: String) { lock.withLock { names.append(name) } }
    var all: [String] { lock.withLock { names } }
}

@MainActor
struct UsernameAvailabilityTests {
    private func model(own: String? = nil, asked: Asked, answer: @escaping @Sendable (String) throws -> UsernameCheck = { _ in UsernameCheck(available: true, reason: nil) }) -> UsernameAvailability {
        UsernameAvailability(own: own, debounce: .milliseconds(60)) { name in
            asked.record(name)
            return try answer(name)
        }
    }

    private func settle() async { try? await Task.sleep(for: .milliseconds(250)) }

    @Test func typingQuicklyAsksOnceAfterTheLastKeystroke() async {
        let asked = Asked()
        let field = model(asked: asked)
        for text in ["n", "ni", "nil", "nilo", "niloofar"] { field.text = text }
        #expect(field.state == .checking)
        await settle()
        #expect(asked.all == ["niloofar"])
        #expect(field.state == .available)
    }

    @Test func theLocalRulesAnswerAtOnceWithoutAskingTheServer() async {
        let asked = Asked()
        let field = model(asked: asked)
        field.text = "ab"
        #expect(field.state == .unavailable(.tooShort))
        field.text = "ab cd"
        #expect(field.state == .unavailable(.badChars))
        field.text = "admin"
        #expect(field.state == .unavailable(.reserved))
        field.text = String(repeating: "a", count: 21)
        #expect(field.state == .unavailable(.tooLong))
        field.text = ""
        #expect(field.state == .idle)
        await settle()
        #expect(asked.all.isEmpty)
    }

    @Test func theServersReasonIsShown() async {
        let asked = Asked()
        let field = model(asked: asked) { _ in UsernameCheck(available: false, reason: "taken") }
        field.text = "hafez"
        #expect(field.state == .checking)
        await settle()
        #expect(field.state == .unavailable(.taken))
        #expect(!field.isAvailable)
    }

    @Test func aLateAnswerForAnOldNameIsIgnored() async {
        let asked = Asked()
        let field = model(asked: asked) { name in UsernameCheck(available: name == "second", reason: "taken") }
        field.text = "first"
        try? await Task.sleep(for: .milliseconds(90))  // the question for «first» is on its way
        field.text = "second"
        await settle()
        #expect(field.state == .available)
        #expect(field.normalized == "second")
    }

    @Test func aFailedQuestionShowsAPersianLineNotACode() async {
        let asked = Asked()
        let field = model(asked: asked) { _ in throw APIError.network }
        field.text = "niloofar"
        await settle()
        #expect(field.state == .failed(APIError.network.persianMessage))
    }

    @Test func theCurrentUsernameIsFreeForItsOwner() async {
        let asked = Asked()
        let field = model(own: "niloofar", asked: asked)
        field.text = "Niloofar"
        #expect(field.state == .available)
        await settle()
        #expect(asked.all.isEmpty)
    }
}
