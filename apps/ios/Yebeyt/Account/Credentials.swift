import AuthenticationServices
import CryptoKit
import Foundation
import GoogleSignIn
import UIKit

/// What a provider handed back, ready for the server.
enum ProviderCredential: Sendable {
    case apple(identityToken: String, authorizationCode: String?, nonce: String)
    case google(idToken: String)
}

/// A credential and the name the provider shared (used only to fill in the display name field).
struct ProviderSignIn: Sendable {
    var credential: ProviderCredential
    var name: String?
}

enum SignInError: Error, Equatable {
    /// The person closed the provider's sheet.
    case canceled
    case failed
}

/// Where credentials come from. The app uses Apple's and Google's sheets; tests use a fake.
protocol CredentialSource: Sendable {
    @MainActor func signIn(with provider: AuthProvider) async throws -> ProviderSignIn
}

struct SystemCredentialSource: CredentialSource {
    @MainActor func signIn(with provider: AuthProvider) async throws -> ProviderSignIn {
        switch provider {
        case .apple: try await AppleSignIn().signIn()
        case .google: try await googleSignIn()
        }
    }

    @MainActor private func googleSignIn() async throws -> ProviderSignIn {
        guard let presenter = UIApplication.topViewController else { throw SignInError.failed }
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            guard let idToken = result.user.idToken?.tokenString else { throw SignInError.failed }
            return ProviderSignIn(credential: .google(idToken: idToken), name: result.user.profile?.name)
        } catch let error as GIDSignInError where error.code == .canceled {
            throw SignInError.canceled
        } catch let error as SignInError {
            throw error
        } catch {
            throw SignInError.failed
        }
    }
}

/// The nonce of Sign in with Apple: Apple gets its SHA-256, the server the raw value.
enum AppleNonce {
    private static let alphabet = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-.")  // 64 characters: no modulo bias

    static func random(length: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        guard SecRandomCopyBytes(kSecRandomDefault, length, &bytes) == errSecSuccess else {
            return UUID().uuidString + UUID().uuidString  // a failing system random is not expected; still never a fixed value
        }
        return String(bytes.map { alphabet[Int($0) % alphabet.count] })
    }

    /// Lower-case hex, the form the server compares with the identity token's `nonce`.
    static func sha256(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// One run of the Apple sign-in sheet.
@MainActor
final class AppleSignIn: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<ProviderSignIn, Error>?
    private var nonce = ""

    func signIn() async throws -> ProviderSignIn {
        nonce = AppleNonce.random()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName]
        request.nonce = AppleNonce.sha256(nonce)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            controller.performRequests()
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let apple = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = apple.identityToken, let identityToken = String(data: tokenData, encoding: .utf8) else {
            finish(.failure(SignInError.failed))
            return
        }
        let code = apple.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        let name = apple.fullName.map { PersonNameComponentsFormatter().string(from: $0) }.flatMap { $0.isEmpty ? nil : $0 }
        finish(.success(ProviderSignIn(credential: .apple(identityToken: identityToken, authorizationCode: code, nonce: nonce), name: name)))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        finish(.failure((error as? ASAuthorizationError)?.code == .canceled ? SignInError.canceled : SignInError.failed))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.keyWindow ?? ASPresentationAnchor()
    }

    private func finish(_ result: Result<ProviderSignIn, Error>) {
        continuation?.resume(with: result)
        continuation = nil
    }
}

extension UIApplication {
    static var keyWindow: UIWindow? {
        shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).first(where: \.isKeyWindow)
    }

    /// The view controller in front, for sheets of other SDKs.
    static var topViewController: UIViewController? {
        var top = keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
