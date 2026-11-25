import SwiftUI

/// دیوانِ من: the kept couplets, with search, grouping by poet, topic or newest, and poet chips.
struct DivanScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(ReaderMarks.self) private var marks
    @Environment(PrivacyStore.self) private var privacy
    @Environment(Library.self) private var library
    @Environment(PoetryStore.self) private var poetry
    @State private var divan = DivanModel()
    @State private var query = ""
    @State private var grouping = DivanGrouping.poet
    @State private var paging = SegmentPaging()
    @State private var poet: String?

    private var keptKeys: [String] { marks.keptItems.map(\.key) }

    private func poetName(_ slug: String) -> String { library.poet(slug: slug)?.name ?? slug }

    /// What the divan holds now: a couplet taken out stays out of the lists at once, without waiting for a reload.
    private var entries: [DivanEntry] {
        let kept = marks.keys(.kept)
        return divan.entries.filter { kept.contains($0.key) }
    }

    private var shown: [DivanEntry] { DivanLogic.filter(entries, query: query, poet: poet, poetName: poetName) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if entries.isEmpty, !divan.isLoading {
                    Text("هنوز بیتی نگه نداشتی. توی شعرها «نگه دار» رو بزن.")
                        .font(.ui(14)).foregroundStyle(Tokens.Colors.muted).lineSpacing(5)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .meCard(radius: 20, shadow: 0.06)
                        .accessibilityIdentifier("divanEmpty")
                } else {
                    SearchBox(text: $query, placeholder: "توی دیوانت بگرد: یه کلمه، یه شاعر…")
                        .accessibilityIdentifier("divanSearch")
                    groupingRow
                    poetChips
                    if shown.isEmpty, !entries.isEmpty { NothingFound() }
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(DivanLogic.sections(shown, grouping: grouping, moods: library.moods, poetName: poetName)) { section in
                            sectionView(section)
                        }
                    }
                    .segmentPage(paging, selection: grouping)
                    .animation(Motion.bouncy, value: keptKeys)  // a couplet taken out (or brought back by «برگردون») shrinks away (or in)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader { header }
        .scrollDismissesKeyboard(.interactively)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task(id: keptKeys) { await divan.load(marks.keptItems, using: poetry) }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 12) {
            BackButton()
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("دیوانِ من").font(.title(30)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                Text("\(PersianDigits.string(keptKeys.count)) بیت").font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
                    .accessibilityIdentifier("divanCount")
            }
            Spacer(minLength: 0)
            Button { model.mePath.append(.privacy) } label: {
                HStack(spacing: 5) {
                    if privacy.settings.keptVisibility == .me {
                        LineIcon(shape: LockIcon(), size: 14, lineWidth: 2.4, fill: nil)
                    }
                    Text(privacy.settings.keptVisibility == .me ? "فقط من" : "دوستا").font(.ui(12, weight: .bold))
                }
                .foregroundStyle(Tokens.Colors.muted)
                .padding(.horizontal, 11).frame(height: 32)
                .background(Capsule().fill(Tokens.Colors.white))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("divanVisibility")
        }
    }

    private var groupingRow: some View {
        HStack(spacing: 10) {
            Text("دسته‌بندی:").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.muted)
            SegmentedControl(
                options: DivanGrouping.allCases.map { ($0, $0.title) }, selection: $grouping, style: .divan,
                label: "دسته‌بندی", idPrefix: "grouping", paging: paging
            )
        }
    }

    // MARK: Poet chips

    private var poetChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                allChip
                ForEach(DivanLogic.poetCounts(entries), id: \.slug) { chip in poetChip(chip.slug, chip.count) }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 2)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -18)
    }

    private var allChip: some View {
        let on = poet == nil
        return Button { poet = nil } label: {
            HStack(spacing: 6) {
                Text("همه").font(.ui(13, weight: .bold))
                Text(PersianDigits.string(entries.count)).font(.ui(13)).opacity(0.7)
            }
            .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
            .padding(.horizontal, 14).frame(height: 40)
            .background(Capsule().fill(on ? Tokens.Colors.ink : Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(on ? 0 : 0.06), radius: 3, x: 0, y: 2))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("poetChip-all")
    }

    private func poetChip(_ slug: String, _ count: Int) -> some View {
        let on = poet == slug
        return Button { poet = on ? nil : slug } label: {
            HStack(spacing: 6) {
                if let known = library.poet(slug: slug) { PoetCircle(poet: known, size: 32, border: 2) }
                Text(poetName(slug)).font(.ui(13, weight: on ? .bold : .medium))
                Text(PersianDigits.string(count)).font(.ui(13)).foregroundStyle(on ? Tokens.Colors.white.opacity(0.7) : Color(hex: 0x8A8698))
            }
            .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
            .padding(.leading, 12).padding(.trailing, 4).frame(height: 40)
            .background(Capsule().fill(on ? Tokens.Colors.ink : Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(on ? 0 : 0.06), radius: 3, x: 0, y: 2))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("poetChip-\(slug)")
    }

    // MARK: Sections and cards

    private func sectionView(_ section: DivanSection) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if !section.title.isEmpty { sectionHeader(section) }
            ForEach(section.entries) { card($0).motionTransition(Motion.row) }
        }
        .accessibilityElement(children: .contain)
    }

    private func sectionHeader(_ section: DivanSection) -> some View {
        HStack(spacing: 8) {
            if let slug = section.poetSlug, let known = library.poet(slug: slug) { PoetCircle(poet: known, size: 30, border: 2) }
            Text(section.title).font(.title(20)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3)
            Text("\(PersianDigits.string(section.entries.count)) بیت").font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            Spacer(minLength: 0)
            if let slug = section.poetSlug {
                Button { poet = slug } label: {
                    Text("همه").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                }
                .accessibilityIdentifier("poetAll-\(slug)")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private func card(_ entry: DivanEntry) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            VStack(spacing: 0) {
                Text(entry.couplet.m1).frame(maxWidth: .infinity, alignment: .leading)
                if !entry.couplet.m2.isEmpty { Text(entry.couplet.m2).frame(maxWidth: .infinity, alignment: .trailing) }
            }
            .font(.poem(16)).lineSpacing(6)
            .foregroundStyle(Tokens.Colors.ink)
            HStack {
                Text("\(entry.title) · \(DivanDays.relative(keptAt: entry.keptAt, now: .now))")
                    .font(.ui(11)).foregroundStyle(Color(hex: 0x8A8698))
                Spacer(minLength: 0)
                Button { marks.toggleKept(poemPath: entry.path, couplet: entry.index) { model.showToast($0, undo: $1) } } label: {
                    LineIcon(shape: BookmarkIcon(), size: 18, lineWidth: 2, fill: Tokens.Colors.lapis).foregroundStyle(Tokens.Colors.lapis)
                        .frame(width: 36, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("نگه دار")
                .accessibilityAddTraits(.isSelected)
                .accessibilityIdentifier("unkeep-\(entry.key)")
            }
        }
        .padding(EdgeInsets(top: 12, leading: 16, bottom: 6, trailing: 8))
        .meCard(radius: 20, shadow: 0.06)
        .contentShape(RoundedRectangle(cornerRadius: 20))
        .onTapGesture { model.openReader(ReaderRoute(path: entry.path, couplet: entry.index)) }
        .onLongPressGesture(minimumDuration: 0.45) { hold(entry) }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: "کارهای این بیت") { hold(entry) }
        .accessibilityIdentifier("divanCouplet-\(entry.key)")
    }

    private func hold(_ entry: DivanEntry) {
        let poet = poetName(entry.poetSlug)
        model.hold = HeldCouplet(
            path: entry.path, index: entry.index, couplet: entry.couplet,
            caption: ReaderText.caption(poet: poet, title: entry.title, index: entry.index),
            shareText: ReaderText.shareText(entry.couplet, poet: poet, title: entry.title),
            copyText: ReaderText.copyText(entry.couplet, poet: poet)
        )
    }
}
