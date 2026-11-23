import SwiftUI

/// The onboarding screens, one at a time, in front of everything else.
struct OnboardingFlow: View {
    @Environment(OnboardingModel.self) private var onboarding
    @Environment(AccountModel.self) private var account

    var body: some View {
        Group {
            switch onboarding.step {
            case .welcome: OnbWelcomeView()
            case .taste: OnbTasteView()
            case .game: OnbGameView()
            case .account: OnbAccountView()
            case .username: UsernameStep(account: account, onSaved: { onboarding.next() })
            case .friends: OnbFriendsView()
            case nil: EmptyView()
            }
        }
        .id(onboarding.step)
        .transition(.opacity)
        .animation(.snappy, value: onboarding.step)
    }
}
