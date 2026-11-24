import SwiftUI

/// مجوزها: the fonts, the poetry and the libraries the app uses, from THIRD_PARTY_NOTICES.md.
struct LicensesScreen: View {
    private struct Credit: Identifiable {
        let id: String
        let name: String
        let by: String
        let license: String
    }

    private struct CreditGroup: Identifiable {
        let id: String
        let credits: [Credit]
    }

    private static let groups = [
        CreditGroup(id: "قلم‌ها", credits: [
            Credit(id: "parastoo", name: "Parastoo, Gandom, Sahel, Shabnam", by: "Saber Rastikerdar", license: "SIL Open Font License 1.1"),
            Credit(id: "vazirmatn", name: "Vazirmatn", by: "The Vazirmatn Project Authors", license: "SIL Open Font License 1.1"),
            Credit(id: "lalezar", name: "Lalezar", by: "Borna Izadpanah", license: "SIL Open Font License 1.1"),
            Credit(id: "markazi", name: "Markazi Text", by: "The Markazi Text Project Authors", license: "SIL Open Font License 1.1"),
            Credit(id: "noto", name: "Noto Naskh Arabic, Noto Nastaliq Urdu", by: "The Noto Project Authors", license: "SIL Open Font License 1.1"),
        ]),
        CreditGroup(id: "شعر، معنی‌ها و خوانش‌ها", credits: [
            Credit(id: "ganjoor", name: "Ganjoor (ganjoor.net)", by: "Poems, meanings, summaries, biographies and recitations, through ganjoor's public repositories and API", license: "The classical poems are in the public domain"),
        ]),
        CreditGroup(id: "کتابخونه‌ها", credits: [
            Credit(id: "google", name: "GoogleSignIn-iOS and its dependencies", by: "Google", license: "Apache License 2.0"),
        ]),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ScreenHeader(title: "مجوزها")
                ForEach(Self.groups) { group in
                    VStack(alignment: .leading, spacing: 0) {
                        Text(group.id).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).padding(.top, 4).padding(.bottom, 6)
                            .accessibilityAddTraits(.isHeader)
                        ForEach(group.credits) { credit in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(credit.name).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                                Text(credit.by).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                                Text(credit.license).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                            }
                            .environment(\.layoutDirection, .leftToRight)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 8)
                            .accessibilityElement(children: .combine)
                        }
                    }
                    .padding(EdgeInsets(top: 10, leading: 16, bottom: 6, trailing: 16))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .meCard()
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
    }
}
