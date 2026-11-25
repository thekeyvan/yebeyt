import SwiftUI

/// OnbUsername: the display name (filled from the provider) and the username, with live availability.
/// «همینه» saves both. Used by onboarding and by the account sheet when a signed-in person has no username yet.
struct UsernameStep: View {
    let account: AccountModel
    let onSaved: () -> Void
    @State private var name: String
    @State private var availability: UsernameAvailability
    @State private var suggestions: [String] = []
    @State private var saving = false
    @State private var error: String?
    private let nameFromProvider: Bool

    init(account: AccountModel, onSaved: @escaping () -> Void) {
        self.account = account
        self.onSaved = onSaved
        let session = account.session
        let availability = UsernameAvailability(own: session.user?.username) { name in
            let api = session.api
            return try await session.authorized { try await api.checkUsername(name, token: $0) }
        }
        availability.text = session.user?.username ?? ""
        _availability = State(initialValue: availability)
        let saved = session.user?.displayName
        _name = State(initialValue: saved ?? account.providerName ?? "")
        nameFromProvider = saved == nil && account.providerName != nil
    }

    private var nameProblem: DisplayNameRules.Problem? {
        DisplayNameRules.problem(name.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private var provider: AuthProvider? { account.provider ?? account.session.user?.providers.first }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let provider { chip(provider) }
                VStack(alignment: .leading, spacing: 4) {
                    Text("یه نام کاربری انتخاب کن").font(.title(30)).foregroundStyle(Tokens.Colors.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("دوستات با این پیدات می‌کنن و توی لینک‌هات میاد.").font(.ui(13)).foregroundStyle(Tokens.Colors.muted).lineSpacing(4)
                }
                nameField
                usernameField
                suggestionChips
                inviteLink
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 16)
        }
        .scrollIndicators(.hidden)
        .dismissesKeyboard()
        .safeAreaInset(edge: .bottom, spacing: 8) { saveButton }
        .dottedPaper()
        .task { await loadSuggestions() }
    }

    // MARK: Pieces

    private func chip(_ provider: AuthProvider) -> some View {
        HStack(spacing: 8) {
            Group {
                if provider == .apple {
                    Circle().fill(.black).overlay { AppleMark(size: 14) }
                } else {
                    Circle().fill(Tokens.Colors.white).overlay { GoogleMark(size: 14) }.overlay(Circle().strokeBorder(Color(hex: 0xDADCE0), lineWidth: 1))
                }
            }
            .frame(width: 24, height: 24)
            Text(provider == .apple ? "با اپل وارد شدی" : "با گوگل وارد شدی").font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
        }
        .padding(EdgeInsets(top: 6, leading: 8, bottom: 6, trailing: 14))
        .background(Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 4, x: 0, y: 2))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("providerChip")
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 6) {
            (Text("اسمت").font(.ui(13, weight: .bold)).foregroundColor(Tokens.Colors.ink)
                + Text(nameFromProvider ? " · از حساب \(provider == .google ? "گوگلت" : "اپلت")" : "").font(.ui(13, weight: .medium)).foregroundColor(Color(hex: 0x8A8698)))
            TextField("", text: $name)
                .font(.ui(16, weight: .medium))
                .foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 16)
                .frame(height: 52)
                .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.white))
                .accessibilityIdentifier("displayName")
            if let problem = nameProblem {
                Text(problem.message).font(.ui(12)).foregroundStyle(Tokens.Colors.fire).accessibilityIdentifier("nameProblem")
            }
        }
    }

    private var usernameField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("نام کاربری").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
            HStack(spacing: 4) {
                Text("@").foregroundStyle(Color(hex: 0x8A8698))
                TextField("", text: $availability.text)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.asciiCapable)
                    .foregroundStyle(Tokens.Colors.ink)
                    .accessibilityIdentifier("username")
                status
            }
            .font(.system(size: 17, weight: .bold))
            .environment(\.layoutDirection, .leftToRight)
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.white))
            .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(borderColor, lineWidth: 2) }
            Text(UsernameRules.hint)
                .font(.ui(11.5)).foregroundStyle(Color(hex: 0x8A8698)).lineSpacing(3)
                .accessibilityIdentifier("usernameHint")
        }
    }

    private var borderColor: Color {
        switch availability.state {
        case .available: Tokens.Colors.green
        case .unavailable, .failed: Tokens.Colors.fire
        case .idle, .checking: .clear
        }
    }

    @ViewBuilder private var status: some View {
        switch availability.state {
        case .idle: EmptyView()
        case .checking: ProgressView().controlSize(.small)
        case .available:
            HStack(spacing: 4) {
                LineIcon(shape: CheckIcon(), size: 14, lineWidth: 3.2, fill: nil)
                Text("آزاده").font(.ui(12))
            }
            .foregroundStyle(Color(hex: 0x3E9A1E))
            .environment(\.layoutDirection, .rightToLeft)
            .accessibilityIdentifier("usernameAvailable")
        case .unavailable(let problem):
            Text(problem.message).font(.ui(12)).foregroundStyle(Tokens.Colors.fire)
                .environment(\.layoutDirection, .rightToLeft)
                .accessibilityIdentifier("usernameProblem")
        case .failed(let message):
            Text(message).font(.ui(12)).foregroundStyle(Tokens.Colors.fire).lineLimit(1)
                .environment(\.layoutDirection, .rightToLeft)
        }
    }

    @ViewBuilder private var suggestionChips: some View {
        if !suggestions.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("یا یکی از این‌ها:").font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.muted)
                WrapLayout(spacing: 8, lineSpacing: 8, centered: false) {
                    ForEach(suggestions, id: \.self) { suggestion in
                        Button { availability.text = suggestion } label: {
                            Text(suggestion).font(.system(size: 13, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                                .environment(\.layoutDirection, .leftToRight)
                                .padding(.horizontal, 12).frame(height: 32)
                                .background(Capsule().fill(Tokens.Colors.white))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var inviteLink: some View {
        HStack(spacing: 10) {
            Text("لینک دعوتت:").font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            Text(InviteLink.display(username: availability.normalized.isEmpty ? "username" : availability.normalized))
                .font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                .environment(\.layoutDirection, .leftToRight)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 16).fill(Tokens.Colors.lapisTint))
        .accessibilityElement(children: .combine)
    }

    private var saveButton: some View {
        VStack(spacing: 8) {
            if let error { Text(error).font(.ui(12, weight: .medium)).foregroundStyle(Tokens.Colors.fire).accessibilityIdentifier("saveError") }
            Button("همینه") { save() }
                .buttonStyle(OnbButtonStyle())
                .disabled(!availability.isAvailable || saving || nameProblem != nil)
                .accessibilityIdentifier("usernameDone")
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 8)
    }

    // MARK: Actions

    private func save() {
        saving = true
        error = nil
        Task {
            error = await account.saveProfile(displayName: name, username: availability.normalized)
            saving = false
            if error == nil { onSaved() }
        }
    }

    private func loadSuggestions() async {
        let session = account.session
        let base = UsernameRules.suggestionBase(from: name)
        let api = session.api
        let found = try? await session.authorized { try await api.usernameSuggestions(base: base, token: $0) }
        suggestions = (found ?? []).filter { $0 != availability.normalized }
    }
}

/// The personal invite link (https://yebeyt.com/i/<username>).
enum InviteLink {
    static func display(username: String) -> String { "yebeyt.com/i/\(username)" }
    static func url(username: String) -> String { "https://\(display(username: username))" }
}
