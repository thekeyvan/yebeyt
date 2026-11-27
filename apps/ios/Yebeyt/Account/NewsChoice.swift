import Foundation

/// The settings rows of the email: «ایمیل» and the switch «خبرهای یه بیت رو برام ایمیل کن».
enum NewsChoice {
    static let emailTitle = "ایمیل"
    static let hiddenEmail = "مخفی (اپل)"
    static let switchTitle = "خبرهای یه بیت رو برام ایمیل کن"
    static let switchNote = "هر وقت بخوای خاموشش کن"

    /// What the email row shows: the address, «مخفی (اپل)» for Apple's relay address, nil (no row) without one.
    static func emailLine(_ email: String?) -> String? {
        guard let email, !email.isEmpty else { return nil }
        return email.lowercased().hasSuffix("@privaterelay.appleid.com") ? hiddenEmail : email
    }

    /// Flips the switch at once, then asks the server; its answer replaces the user, and a failure puts the switch
    /// back (nothing else of the user changes). Returns why the server did not take it, nil when it did.
    @MainActor static func set(_ optIn: Bool, session: Session) async -> APIError? {
        guard let before = session.user else { return .badResponse }
        var chosen = before
        chosen.newsOptIn = optIn
        session.update(user: chosen)
        let api = session.api
        do {
            session.update(user: try await session.authorized { try await api.setNews(optIn, token: $0) })
            return nil
        } catch {
            if var current = session.user {
                current.newsOptIn = before.newsOptIn
                session.update(user: current)
            }
            return error as? APIError ?? .badResponse
        }
    }
}
