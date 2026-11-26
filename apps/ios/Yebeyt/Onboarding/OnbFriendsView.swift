import SwiftUI

/// OnbFriends: the invite link to send, and a search for people by username under it. (The board's contacts card can't
/// exist: accounts have no phone numbers.)
struct OnbFriendsView: View {
    @Environment(OnboardingModel.self) private var onboarding
    @Environment(AccountModel.self) private var account
    @State private var sharing = false

    private var username: String { account.session.user?.username ?? "" }

    var body: some View {
        OnbScreen {
            HStack {
                Button { onboarding.finish() } label: {
                    Text("بعداً")
                        .font(.ui(13, weight: .bold)).foregroundStyle(Color(hex: 0x8A8698))
                        .frame(minHeight: OnbTopBar.tapHeight, alignment: .top)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                    .accessibilityIdentifier("onbLater")
                Spacer()
            }
        } content: { density in
            VStack(spacing: density.gap) {
                OnbHeading(title: "دوستات رو پیدا کن", text: "شعر با رفیق قشنگ‌تره. هر کی رو پیدا کنی، بیت‌هایی که به اشتراک می‌ذاره توی خونه‌ت میاد.")
                    .frame(maxWidth: .infinity, alignment: .leading)
                inviteCard
                OnboardingPeopleSearch()
            }
        } footer: {
            Button("بریم خونه") { onboarding.finish() }
                .buttonStyle(OnbButtonStyle())
                .accessibilityIdentifier("onbHome")
        }
        .sheet(isPresented: $sharing) { ShareSheet(text: InviteLink.url(username: username)).presentationDetents([.medium, .large]) }
    }

    private var inviteCard: some View {
        Button { sharing = true } label: {
            HStack(spacing: 12) {
                Circle().fill(Tokens.Colors.amber)
                    .overlay {
                        LineIcon(shape: SVGShape(d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"), size: 20, lineWidth: 2.2, fill: nil)
                            .foregroundStyle(Tokens.Colors.ink)
                    }
                    .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .frame(width: 44, height: 44)
                    .shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 3, x: 0, y: 2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("لینک دعوتت رو بفرست").font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                    Text(InviteLink.display(username: username)).font(.ui(12)).foregroundStyle(Tokens.Colors.lapis)
                        .environment(\.layoutDirection, .leftToRight)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background { RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 11, x: 0, y: 6) }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("onbInvite")
    }
}
