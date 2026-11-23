import Foundation

/// «پاک کردن حساب»: asks the server to delete the account and everything stored for it, then signs out here and
/// forgets what on this phone belongs to the account: the divan with its times, the privacy settings and the face.
/// What a guest has anyway (reading, game scores, text settings) stays. When the server can't do it (Apple's
/// token can't be revoked right now, no network) nothing changes and the person is told.
@MainActor
struct AccountDeletion {
    let session: Session
    let marks: ReaderMarks
    let privacy: PrivacyStore
    let avatar: AvatarStore

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
        marks.clearDivan()
        privacy.clear()
        avatar.clear()
        return nil
    }
}
