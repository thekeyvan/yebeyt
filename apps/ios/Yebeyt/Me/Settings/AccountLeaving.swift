import Foundation

/// What on this phone belongs to an account: the divan with its times, the likes and reposts, the privacy settings
/// and the face. It goes when the person signs out or deletes the account, so the next person to sign in on this
/// phone starts clean and nothing is carried over to their account. What a guest has anyway (reading, game scores,
/// text settings) stays.
@MainActor
struct LocalAccountData {
    let marks: ReaderMarks
    let privacy: PrivacyStore
    let avatar: AvatarStore

    func clear() {
        marks.clearAccountData()
        privacy.clear()
        avatar.clear()
    }
}

/// «خروج از حساب»: one last sync (the divan, an unsent face, unsent privacy changes), so nothing made on this phone
/// is lost, then the sign-in is forgotten and the account's data goes from the phone. When the last sync did not go
/// through, nothing happens until the person insists (`force`): what is not on the account would be lost.
@MainActor
struct AccountSignOut {
    enum Outcome: Equatable { case done, unsynced }

    let session: Session
    let data: LocalAccountData
    let divanSync: DivanSync

    @discardableResult
    func signOut(force: Bool = false) async -> Outcome {
        let divanSent = await divanSync.syncNow()
        await data.privacy.flush()
        await data.avatar.flush()
        let everythingSent = divanSent && !data.privacy.hasUnsentChanges && !data.avatar.isUnsent
        guard everythingSent || force else { return .unsynced }
        await session.signOut()
        data.clear()
        return .done
    }
}

/// «پاک کردن حساب»: asks the server to delete the account and everything stored for it, then signs out here and
/// forgets the account's data. When the server can't do it (Apple's token can't be revoked right now, no network)
/// nothing changes and the person is told.
@MainActor
struct AccountDeletion {
    let session: Session
    let data: LocalAccountData

    /// Returns the line to show when it failed; nil when the account is gone.
    func delete() async -> String? {
        let api = session.api
        do {
            try await session.authorized { try await api.deleteAccount(token: $0) }
        } catch let error as APIError {
            return error.persianMessage
        } catch {
            return APIError.badResponse.persianMessage
        }
        await session.signOut(tellServer: false)
        data.clear()
        return nil
    }
}
