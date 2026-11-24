import Foundation
import Observation

/// Where a couplet is going: the key, and the person when the long press happened in a chat with them (then
/// nobody needs to be chosen).
struct SharedDivanTarget: Identifiable, Equatable {
    let id = UUID()
    let key: String
    let person: ChatPerson?
}

/// «به دیوان مشترک»: choose whose shared divan, write a note if you like, and add the couplet. The sheet lists the
/// friends I already share a divan with; «با یه دوست دیگه» lists my other friends, and the divan is made for the one
/// chosen (the server only does it for friends).
@MainActor @Observable
final class SharedDivanAdder {
    enum Phase: Equatable {
        case choosing, adding
        /// Added; the line to show after the sheet closes.
        case done(String)
    }

    static let maxNoteLength = ChatModel.maxNoteLength

    let key: String
    /// The person already known (the chat's), else nil and the sheet lists people.
    let person: ChatPerson?
    private(set) var divans: [SharedDivan] = []
    private(set) var friends: [ChatPerson] = []
    private(set) var isLoading = false
    private(set) var showsFriends = false
    private(set) var phase = Phase.choosing
    /// The person picked in the list; the note and «اضافه کن» come next.
    var chosen: ChatPerson?
    var note = ""
    /// A refusal, shown in the sheet: «فقط با دوستات می‌شه دیوان مشترک داشت».
    private(set) var failure: String?

    @ObservationIgnored private let session: Session

    init(target: SharedDivanTarget, session: Session) {
        key = target.key
        person = target.person
        chosen = target.person
        self.session = session
    }

    /// People with a shared divan first; asked once.
    func load() async {
        guard person == nil, divans.isEmpty, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        var next: String?
        repeat {
            guard let page = try? await session.authorized({ try await self.session.api.sharedDivans(cursor: next, token: $0) }) else { return }
            divans += page.items
            next = page.nextCursor
        } while next != nil
    }

    /// «با یه دوست دیگه»: my friends who have no shared divan yet.
    func showFriends() async {
        showsFriends = true
        guard friends.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        var found: [ChatPerson] = []
        var next: String?
        repeat {
            guard let page = try? await session.authorized({ try await self.session.api.chatFriends(cursor: next, token: $0) }) else { break }
            found += page.items
            next = page.nextCursor
        } while next != nil
        let have = Set(divans.map(\.other.username))
        friends = found.filter { !have.contains($0.username) }
    }

    /// Adds the couplet to the divan with `chosen`. Returns true when it is in.
    @discardableResult
    func add() async -> Bool {
        guard let chosen, phase == .choosing else { return false }
        phase = .adding
        failure = nil
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let text = trimmed.isEmpty ? nil : String(trimmed.prefix(Self.maxNoteLength))
        do {
            let divanID: String
            if let known = divans.first(where: { $0.other.username == chosen.username }) {
                divanID = known.id
            } else {
                divanID = try await session.authorized { try await self.session.api.openSharedDivan(username: chosen.username, token: $0) }.id
            }
            _ = try await session.authorized { try await self.session.api.addSharedDivanItem(id: divanID, key: self.key, note: text, token: $0) }
            phase = .done(MessageCopy.addedToDivan(with: chosen.name))
            return true
        } catch let error as APIError {
            failure = MessageCopy.toast(for: error, sharedDivan: true)
        } catch {}
        phase = .choosing
        return false
    }
}
