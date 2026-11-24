import SwiftUI

/// چهره‌ی تو: the big face, a chip for each part, the choices of that part (the accessories with lock badges and
/// their unlock text) and the couplet of the chosen accessory. «ذخیره» saves it.
struct AvatarScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AvatarStore.self) private var store
    @Environment(GameStats.self) private var stats
    @Environment(Achievements.self) private var achievements
    @State private var draft = AvatarParts.standard
    @State private var part = AvatarPart.accessory
    @State private var loaded = false

    private var progress: AvatarProgress { AvatarProgress(stats: stats, achievements: achievements) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                bigFace
                partChips
                grid
                if part == .accessory, let card = Accessory(rawValue: draft.accessory)?.card { couplet(card) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            guard !loaded else { return }
            loaded = true
            draft = store.parts
        }
    }

    // MARK: Pieces

    private var header: some View {
        HStack(spacing: 12) {
            BackButton()
            Text("چهره‌ی تو").font(.title(30)).foregroundStyle(Tokens.Colors.ink).padding(.top, 4)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            Button {
                store.save(draft)  // saved at once, sent in the background
                dismiss()
            } label: {
                Text("ذخیره").font(.title(18)).foregroundStyle(Tokens.Colors.white)
                    .padding(EdgeInsets(top: 6, leading: 16, bottom: 2, trailing: 16))
                    .sticker(fill: Tokens.Colors.lapis, radius: 16, border: 4, shadow: ShadowToken(y: 2, blur: 8, opacity: 0.22))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("avatarSave")
        }
    }

    private var bigFace: some View {
        HStack {
            Spacer(minLength: 0)
            ZStack(alignment: .bottomTrailing) {
                AvatarView(parts: draft)
                    .padding(7)
                    .background(Circle().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 4, blur: 16, opacity: 0.18)))
                    .frame(width: 210, height: 210)
                Button(action: shuffle) {
                    LineIcon(shape: DiceIcon(), size: 20, lineWidth: 2.4, fill: nil).foregroundStyle(Tokens.Colors.ink)
                        .frame(width: 46, height: 46)
                        .background(Circle().fill(Tokens.Colors.amber))
                        .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 4))
                        .stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.22))
                }
                .buttonStyle(.plain)
                .padding(6)
                .accessibilityLabel("چهره‌ی تصادفی")
                .accessibilityIdentifier("avatarShuffle")
            }
            .frame(width: 210, height: 210)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }

    private var partChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(AvatarPart.allCases, id: \.self) { chip in
                    let on = chip == part
                    Button { part = chip } label: {
                        Text(chip.title).font(.ui(13, weight: on ? .bold : .medium))
                            .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
                            .padding(.horizontal, 13).padding(.vertical, 7)
                            .background(Capsule().fill(on ? Tokens.Colors.lapis : Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 3, x: 0, y: 2))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                    .accessibilityIdentifier("avatarPart-\(chip.rawValue)")
                }
            }
            .padding(.horizontal, 18).padding(.bottom, 2)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -18)
    }

    private var grid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
            ForEach(AvatarCatalogue.options(for: part)) { option in tile(option) }
        }
    }

    private func tile(_ option: AvatarOption) -> some View {
        let accessory = part == .accessory ? Accessory(rawValue: option.id) : nil
        let locked = accessory.map { !$0.isUnlocked(progress) } ?? false
        let chosen = draft[part] == option.id
        return Button {
            if let next = AvatarCatalogue.choosing(option.id, for: part, in: draft, progress: progress) { draft = next }
        } label: {
            VStack(spacing: 4) {
                preview(option, accessory: accessory).opacity(locked ? 0.55 : 1)
                if part == .accessory { Text(option.title).font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.ink) }
                if let text = accessory?.unlockText, locked {
                    Text(text).font(.ui(10)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center).lineSpacing(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(6)
            .frame(maxWidth: .infinity, minHeight: 108, maxHeight: 108)
            .background(RoundedRectangle(cornerRadius: 18).fill(Tokens.Colors.white))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(chosen ? Tokens.Colors.lapis : Tokens.Colors.white, lineWidth: 4))
            .overlay(alignment: .topTrailing) {
                if locked {
                    LineIcon(shape: LockIcon(), size: 12, lineWidth: 3, fill: nil).foregroundStyle(Tokens.Colors.white)
                        .frame(width: 22, height: 22).background(Circle().fill(Tokens.Colors.ink))
                        .padding(6)
                        .accessibilityLabel("قفل")
                }
            }
            .stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.12))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.title)
        .accessibilityValue(locked ? "قفله، \(accessory?.unlockText ?? "")" : "")
        .accessibilityAddTraits(chosen ? .isSelected : [])
        .accessibilityIdentifier("avatarItem-\(option.id)")
    }

    @ViewBuilder
    private func preview(_ option: AvatarOption, accessory: Accessory?) -> some View {
        if let accessory {
            AccessoryIcon(accessory: accessory)
        } else {
            switch part {
            case .face: swatch(AvatarCatalogue.skin(option.id))
            case .hair: swatch(AvatarCatalogue.hair(option.id))
            case .background: swatch(AvatarCatalogue.background(option.id))
            default:
                AvatarView(parts: AvatarCatalogue.choosing(option.id, for: part, in: draft, progress: progress) ?? draft)
                    .frame(width: 80, height: 80)
            }
        }
    }

    private func swatch(_ hex: UInt32) -> some View {
        Circle().fill(Color(hex: hex))
            .overlay(Circle().strokeBorder(Tokens.Colors.ring, lineWidth: 2))
            .frame(width: 44, height: 44)
    }

    private func couplet(_ card: (source: String, couplet: String)) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(card.source).font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
            Text(card.couplet).font(.poem(17)).lineSpacing(6).foregroundStyle(Tokens.Colors.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14).padding(.vertical, 12)
        .meCard(radius: 20)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("avatarCouplet")
    }

    /// The dice: a random choice for every part, the accessory among the unlocked ones.
    private func shuffle() {
        var next = draft
        for part in AvatarPart.allCases {
            let open = AvatarCatalogue.options(for: part).filter {
                AvatarCatalogue.choosing($0.id, for: part, in: next, progress: progress) != nil
            }
            if let pick = open.randomElement() { next[part] = pick.id }
        }
        draft = next
    }
}
