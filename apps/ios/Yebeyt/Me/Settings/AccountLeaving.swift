import Foundation

/// What on this phone belongs to an account: the divan with its times, the privacy settings and the face (and, for
/// deleting, the likes and reposts). It goes when the person signs out or deletes the account, so nothing of it is carried over to the
/// next account on this phone. Likes and reposts stay on sign-out and go only with a deleted account, until they sync with the server.
/// What a guest has anyway (reading, game scores, text settings) stays.
@MainActor
struct LocalAccountData {
    let marks: ReaderMarks
    let privacy: PrivacyStore
    let avatar: AvatarStore

    /// Signing out: the divan, the privacy settings and the face go. The likes and reposts stay until they live on
    /// the server.
    func clearForSignOut() {
        marks.clearDivan()
        privacy.clear()
        avatar.clear()
    }

    /// Deleting the account: all of it.
    func clearAll() {
        clearForSignOut()
        marks.clearLikesAndReposts()
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

    /// `force` is the person's answer to the warning: no more syncing, just out.
    @discardableResult
    func signOut(force: Bool = false) async -> Outcome {
        if !force {
            let divanSent = await divanSync.syncNow()
            await data.privacy.flush()
            await data.avatar.flush()
            guard divanSent, !data.privacy.hasUnsentChanges, !data.avatar.isUnsent else { return .unsynced }
        }
        await divanSync.stop()
        await data.privacy.settle()
        await data.avatar.settle()
        await session.signOut()
        data.clearForSignOut()
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
    let divanSync: DivanSync

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
        // Whatever was on its way when the account went must land (or fail) before the phone is cleared.
        await divanSync.stop()
        await data.privacy.settle()
        await data.avatar.settle()
        data.clearAll()
        return nil
    }
}
