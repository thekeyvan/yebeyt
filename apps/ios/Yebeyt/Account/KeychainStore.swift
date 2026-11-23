import Foundation
import os
import Security

/// What the Keychain holds right now.
enum KeychainRead: Equatable, Sendable {
    case value(String)
    case none
    /// It cannot be read at the moment (the phone is locked, errSecInteractionNotAllowed, or another error):
    /// try later, never treat it as signed out.
    case unavailable

    var value: String? {
        if case .value(let text) = self { text } else { nil }
    }
}

/// The refresh token, kept in the Keychain (this device only, not synced or backed up). One value per
/// `service`; tests use their own.
struct KeychainStore: Sendable {
    static let appService = "com.yebeyt.app.session"
    private static let log = Logger(subsystem: "com.yebeyt.app", category: "keychain")

    typealias CopyMatching = @Sendable (CFDictionary, UnsafeMutablePointer<CFTypeRef?>?) -> OSStatus

    let service: String
    private let account = "refreshToken"
    private let copyMatching: CopyMatching

    /// `copyMatching` stands in for the system call in tests.
    init(service: String = Self.appService, copyMatching: @escaping CopyMatching = { SecItemCopyMatching($0, $1) }) {
        self.service = service
        self.copyMatching = copyMatching
    }

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }

    func load() -> KeychainRead {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = copyMatching(request as CFDictionary, &result)
        return Self.read(status: status, data: result as? Data)
    }

    /// The token, or nil when there is none or it can't be read now (use `load()` to tell them apart).
    func read() -> String? { load().value }

    static func read(status: OSStatus, data: Data?) -> KeychainRead {
        switch status {
        case errSecSuccess:
            return data.flatMap { String(data: $0, encoding: .utf8) }.map(KeychainRead.value) ?? .none
        case errSecItemNotFound:
            return .none
        default:
            log.error("Keychain read failed, status \(status)")
            return .unavailable
        }
    }

    /// Replaces the stored value. Returns false (and logs the status, never the token) when it could not be stored.
    @discardableResult
    func write(_ value: String) -> Bool {
        delete()
        var item = query
        item[kSecValueData as String] = Data(value.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        if status != errSecSuccess { Self.log.error("Keychain write failed, status \(status)") }
        return status == errSecSuccess
    }

    func delete() {
        SecItemDelete(query as CFDictionary)
    }
}
