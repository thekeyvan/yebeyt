import Foundation

/// What on this phone belongs to an account: the divan with its times, the likes and reposts, the privacy settings and
/// the face, and the scores and reactions not sent yet. It goes when the person signs out or deletes the account, so
/// nothing of it is carried over to the next account on this phone (the game points stay on the phone, but only as the
/// leaving account's: the next one may claim just what is earned after). What a guest has anyway (reading, game scores,
/// text settings) stays.
@MainActor
struct LocalAccountData {
    let marks: ReaderMarks
    let privacy: PrivacyStore
    let avatar: AvatarStore
    let reactions: ReactionsSync
    let scores: ScoreSync
    let stats: GameStats

    func clearForSignOut() {
        stats.release()
        marks.clearDivan()
        marks.clearLikesAndReposts()
        reactions.clear()
        scores.clear()
        privacy.clear()
        avatar.clear()
    }
}

/// The question before «خروج از حساب». What it says is what `AccountSignOut` does: one last sync of the divan, then the divan
/// leaves this phone, and signing in again brings it back from the account.
enum SignOutCopy {
    static let title = "از حسابت بیرون بری؟"
    static let message = "دیوانت به حسابت همگام می‌شه و از این گوشی پاک می‌شه؛ با ورود دوباره برمی‌گرده."
    static let confirm = "بیرون برو"
    static let stay = "نه"
}

/// «خروج از حساب»: one last sync (the divan, the likes and reposts, an unsent face, unsent privacy changes, the scores), so nothing made on this phone
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
            let reactionsSent = await data.reactions.syncNow()
            await data.privacy.flush()
            await data.avatar.flush()
            await data.scores.flush()
            guard divanSent, reactionsSent, !data.scores.hasUnsent, !data.privacy.hasUnsentChanges, !data.avatar.isUnsent else { return .unsynced }
        }
        await divanSync.stop()
        await data.reactions.stop()
        await data.scores.settle()
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
            return FeedbackLog.shared.shown(error)
        } catch {
            return APIError.badResponse.persianMessage
        }
        await session.signOut(tellServer: false)
        // Whatever was on its way when the account went must land (or fail) before the phone is cleared.
        await divanSync.stop()
        await data.reactions.stop()
        await data.scores.settle()
        await data.privacy.settle()
        await data.avatar.settle()
        data.clearForSignOut()
        return nil
    }
}
