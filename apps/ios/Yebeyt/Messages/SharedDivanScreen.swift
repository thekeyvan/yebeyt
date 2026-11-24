import SwiftUI

/// دیوان من و <name>: the couplets two friends keep together. Board: `SharedDivan`. It is opened from the chat's
/// header (or a «… به دیوان مشترک اضافه کرد» line) by the person's username.
struct SharedDivanScreen: View {
    @Environment(MessagesCenter.self) private var center
    let username: String

    var body: some View {
        SharedDivanContent(model: center.sharedDivan(username: username))
    }
}

private struct SharedDivanContent: View {
    @Environment(AvatarStore.self) private var avatar
    @Environment(PoetryStore.self) private var store
    @Bindable var model: SharedDivanModel
    @State private var adding = false

    private var name: String { model.other?.name ?? model.username }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            privacyNote
            chips
            content
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .messageToast($model.toast, bottom: 40)
        .sheet(isPresented: $adding) {
            CoupletPickerSheet(title: "یه بیت اضافه کن", action: "اضافه کن") { key, note in
                Task { await model.add(key: key, note: note) }
            }
        }
        .task { await model.load() }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 10) {
            BackButton()
            HStack(spacing: -14) {
                Face(parts: avatar.parts, size: 42, border: 3)
                Face(parts: model.other?.avatar, size: 42, border: 3)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text("دیوان من و \(name)").font(.title(22)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                if let subtitle = model.subtitle(name: name) {
                    Text(subtitle).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                }
            }
            .padding(.leading, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            Button { adding = true } label: {
                LineIcon(shape: PlusShape(), size: 22, lineWidth: 2.8, fill: nil)
                    .foregroundStyle(Tokens.Colors.white)
                    .frame(width: 46, height: 46)
                    .background(Circle().fill(Tokens.Colors.lapis))
                    .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 4))
                    .shadow(color: Tokens.Colors.lapis.opacity(0.3), radius: 5, x: 0, y: 3)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("یه بیت اضافه کن")
            .accessibilityIdentifier("addToDivan")
        }
    }

    private var privacyNote: some View {
        HStack(spacing: 6) {
            LineIcon(shape: LockIcon(), size: 13, lineWidth: 2.4, fill: nil)
            Text("فقط تو و \(name) می‌بینید").font(.ui(12))
        }
        .foregroundStyle(Tokens.Colors.muted)
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .background(Capsule().fill(Tokens.Colors.white.opacity(0.8)))
    }

    // MARK: Chips

    private var chips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                chip("همه", .all)
                chip("از \(name)", .them)
                chip("از من", .me)
                ForEach(model.poetSlugs, id: \.self) { slug in
                    chip(store.poets.first { $0.slug == slug }?.nickname ?? slug, .poet(slug))
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 2)
        }
        .padding(.horizontal, -18)
        .scrollIndicators(.hidden)
    }

    private func chip(_ title: String, _ filter: SharedDivanModel.Filter) -> some View {
        let on = model.filter == filter
        return Button { Task { await model.select(filter) } } label: {
            Text(title)
                .font(.ui(13, weight: on ? .bold : .medium))
                .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
                .padding(.horizontal, 13)
                .frame(height: 34)
                .background(Capsule().fill(on ? Tokens.Colors.ink : Tokens.Colors.white))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("chip-\(Self.identifier(filter))")
    }

    private static func identifier(_ filter: SharedDivanModel.Filter) -> String {
        switch filter {
        case .all: "all"
        case .them: "them"
        case .me: "me"
        case .poet(let slug): slug
        }
    }

    // MARK: Cards

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .loading:
            Spacer()
        case .failed(let reason):
            VStack(alignment: .leading, spacing: 10) {
                Text(reason).font(.ui(14)).foregroundStyle(Tokens.Colors.muted)
                Button("دوباره") { Task { await model.load() } }.font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
            }
        case .loaded:
            if model.visibleItems.isEmpty {
                Text("هنوز بیتی توی این دیوان نیست. با «+» یکی اضافه کن.").font(.ui(14)).foregroundStyle(Tokens.Colors.muted).lineSpacing(5)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        let items = model.visibleItems
                        ForEach(items) { item in
                            SharedDivanCard(item: item, name: name, otherFace: model.other?.avatar, myFace: avatar.parts, like: { Task { await model.toggleLike(item) } })
                                .onAppear { if item.id == items.last?.id { Task { await model.loadMore() } } }
                        }
                    }
                    .padding(.bottom, 24)
                }
                .scrollIndicators(.hidden)
                .scrollClipDisabled()
            }
        }
    }
}

/// «+»: two bars.
private struct PlusShape: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M12 5v14M5 12h14").path(in: rect)
    }
}

private struct SharedDivanCard: View {
    @Environment(AppModel.self) private var app
    @Environment(CoupletResolver.self) private var resolver
    let item: SharedDivanItem
    let name: String
    let otherFace: AvatarParts?
    let myFace: AvatarParts
    let like: () -> Void
    @State private var resolved: ResolvedCouplet?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            adder
            if let note = item.note, !note.isEmpty { noteBubble(note) }
            couplet
            footer
        }
        .padding(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
        .background {
            RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 2, blur: 20, opacity: 0.07))
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sharedItem-\(item.id)")
        .task(id: item.key) { resolved = await resolver.resolve(item.key) }
    }

    private var adder: some View {
        HStack(spacing: 8) {
            Face(parts: item.addedByMe ? myFace : otherFace, size: 26, border: 2)
            Text("\(Text(item.addedByMe ? "تو" : name).font(.ui(12, weight: .bold)).foregroundColor(Tokens.Colors.ink)) اضافه کرد · \(ChatTime.added(item.createdAt, now: .now))")
                .font(.ui(12))
                .foregroundStyle(Tokens.Colors.muted)
        }
    }

    private func noteBubble(_ note: String) -> some View {
        HStack(spacing: 0) {
            Text(note)
                .font(.ui(13))
                .lineSpacing(3)
                .foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 4, bottomLeading: 16, bottomTrailing: 16, topTrailing: 16)).fill(Color(hex: 0xFFF1F6)))
            Spacer(minLength: 40)
        }
    }

    @ViewBuilder private var couplet: some View {
        if let resolved {
            CoupletText(couplet: resolved.couplet, settings: Self.settings, size: 17, factor: 1.85, color: Tokens.Colors.ink)
                .contentShape(Rectangle())
                .onTapGesture { app.openReader(ReaderRoute(path: resolved.path, couplet: resolved.index)) }
                .onLongPressGesture(minimumDuration: 0.45) { withAnimation(.snappy) { app.hold = resolved.held } }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(resolved.couplet.m1)، \(resolved.couplet.m2)")
                .accessibilityAddTraits(.isButton)
                .accessibilityAction(named: "کارهای این بیت") { app.hold = resolved.held }
                .accessibilityIdentifier("sharedCouplet-\(item.id)")
        } else {
            Text("…").font(.ui(17)).foregroundStyle(Tokens.Colors.muted).frame(maxWidth: .infinity).padding(.vertical, 20)
        }
    }

    private var footer: some View {
        HStack {
            Text(resolved?.source ?? "").font(.ui(12)).foregroundStyle(Color(hex: 0x8A8698))
            Spacer(minLength: 8)
            Button(action: like) {
                HStack(spacing: 4) {
                    let any = item.likedByMe || item.likedByThem
                    LineIcon(shape: HeartIcon(), size: 18, lineWidth: 2, fill: any ? Tokens.Colors.magenta : nil)
                        .foregroundStyle(any ? Tokens.Colors.magenta : Tokens.Colors.ink)
                    Text(likeText).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                }
                .padding(.vertical, 4)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(item.likedByMe ? "پسندت رو بردار" : "پسند")
            .accessibilityValue(likeText)
            .accessibilityAddTraits(item.likedByMe ? .isSelected : [])
            .accessibilityIdentifier("like-\(item.id)")
        }
    }

    private var likeText: String {
        switch (item.likedByMe, item.likedByThem) {
        case (true, true): "تو و \(name) پسندیدید"
        case (true, false): "تو پسندیدی"
        case (false, true): "\(name) پسندید"
        case (false, false): PersianDigits.string(0)
        }
    }

    private static let settings = TextSettings()
}
