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

    typealias AddItem = @Sendable (CFDictionary) -> OSStatus

    let service: String
    private let account = "refreshToken"
    private let copyMatching: CopyMatching
    private let addItem: AddItem

    /// `copyMatching` and `addItem` stand in for the system calls in tests.
    init(
        service: String = Self.appService, copyMatching: @escaping CopyMatching = { SecItemCopyMatching($0, $1) },
        addItem: @escaping AddItem = { SecItemAdd($0, nil) }
    ) {
        self.service = service
        self.copyMatching = copyMatching
        self.addItem = addItem
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

    /// Replaces the stored value in place (an update, so the old token stays until the new one is stored).
    /// Returns false (and logs the status, never the token) when it could not be stored.
    @discardableResult
    func write(_ value: String) -> Bool {
        let data = Data(value.utf8)
        var status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            status = addItem(item as CFDictionary)
        }
        if status != errSecSuccess { Self.log.error("Keychain write failed, status \(status)") }
        return status == errSecSuccess
    }

    func delete() {
        SecItemDelete(query as CFDictionary)
    }
}
