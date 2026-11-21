import SwiftUI

struct LibraryView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @State private var filter = 0 // 0 = famous, otherwise a Hijri century

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("کتابخانه").font(.ui(24, .semibold))
                    Text("\(library.poets.count.fa) شاعر · ۱۳۹٬۴۱۷ شعر").font(.ui(13)).foregroundStyle(Palette.muted)
                }
                Button { router.open(.search) } label: {
                    HStack(spacing: 8) {
                        AppIcon("magnifyingglass")
                        Text("شاعر، کتاب، یه کلمه از شعر…").font(.ui(15))
                        Spacer()
                    }
                    .foregroundStyle(Palette.muted)
                    .padding(.horizontal, 14).frame(height: 44)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Palette.surface))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.line, lineWidth: 1))
                }
                .buttonStyle(PressStyle(scale: 0.99))

                let recents = prefs.recent.filter { library.poem($0.url) != nil }.prefix(8)
                if !recents.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle("اخیراً")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(Array(recents), id: \.url) { r in
                                    if let p = library.poem(r.url) {
                                        Button { router.openPoem(r.url, focus: r.couplet) } label: {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(p.couplets.first?.m1 ?? p.title).font(prefs.verseFont(15)).foregroundStyle(Palette.ink).lineLimit(1)
                                                Text("\(library.nick(p.poet)) · \(p.title)").font(.ui(12)).foregroundStyle(Palette.muted).lineLimit(1)
                                            }
                                            .frame(width: 172, alignment: .leading)
                                            .padding(.horizontal, 14).padding(.vertical, 12)
                                            .background(RoundedRectangle(cornerRadius: 18).fill(Palette.surface))
                                        }
                                        .buttonStyle(PressStyle())
                                    }
                                }
                            }
                            .padding(.horizontal, 18)
                        }
                        .padding(.horizontal, -18)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle("کتاب‌ها")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(Content.starters, id: \.url) { s in BookCover(url: s.url, label: s.label) }
                        }
                        .padding(.horizontal, 18).padding(.vertical, 6)
                    }
                    .padding(.horizontal, -18)
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle("شاعرها")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            Chip(title: "معروف‌ها", selected: filter == 0) { filter = 0 }
                            ForEach(centuries, id: \.self) { c in
                                Chip(title: (c >= 14 ? "معاصر · " : "") + "قرن \(c.fa)", selected: filter == c) { filter = c }
                            }
                        }
                        .padding(.horizontal, 18)
                    }
                    .padding(.horizontal, -18)
                    LazyVStack(spacing: 0) {
                        ForEach(list) { p in
                            IconRow(title: p.nick, subtitle: [p.death > 0 ? "حدود \(yearsAgo(p.death).fa) سال پیش" : "", "\(p.poemCount.fa) شعر", p.birthPlace].filter { !$0.isEmpty }.joined(separator: " · ")) {
                                PoetAvatar(slug: p.slug, name: p.nick, size: 44)
                            } action: { router.show(.poet(p.slug)) }
                            Divider().overlay(Palette.line)
                        }
                    }
                    Note("دوره‌ها بر اساس قرن هجریِ درگذشت شاعره.")
                }
            }
            .pagePadding()
            .padding(.top, 14)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .background(Palette.bg)
    }

    private var centuries: [Int] { Array(Set(library.poets.map(\.century).filter { $0 > 0 })).sorted() }
    private var list: [Poet] {
        filter == 0
            ? library.poets.filter { $0.pin > 0 }.sorted { $0.pin < $1.pin }
            : library.poets.filter { $0.century == filter }.sorted { $0.death < $1.death }
    }
}

/// A book or a part of one. Bundled books list instantly; the rest load from Ganjoor's data.
struct BookView: View {
    let url: String
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @State private var page: CategoryPage?
    @State private var failed = false
    @State private var query = ""

    var body: some View {
        VStack(spacing: 0) {
            ScreenBar(title: title)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    if library.isLocalBook(url) {
                        searchField
                        localList
                    } else if let page {
                        if !page.children.isEmpty {
                            VStack(spacing: 0) {
                                ForEach(page.children) { c in
                                    IconRow(title: c.title, subtitle: "بخش") { IconSquare(icon: "folder") } action: { router.open(.book(c.url)) }
                                    Divider().overlay(Palette.line)
                                }
                            }
                        }
                        if !page.poems.isEmpty {
                            if page.poems.count > 12 { searchField }
                            LazyVStack(spacing: 0) {
                                ForEach(Array(page.poems.enumerated()).filter { query.isEmpty || $0.element.title.norm.contains(query.norm) }, id: \.element.url) { i, item in
                                    tocRow(i + 1, title: item.title, sub: item.excerpt, count: nil) { router.openPoem(item.url) }
                                }
                            }
                        }
                    } else if failed {
                        EmptyNote(text: "فهرست بار نشد.\nاینترنت رو چک کن و دوباره بزن.")
                        PillButton(title: "دوباره", kind: .primary) { Task { await load() } }
                    } else {
                        ProgressView().tint(Palette.muted).frame(maxWidth: .infinity).padding(.top, 40)
                    }
                }
                .pagePadding().padding(.top, 6).padding(.bottom, 40)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.immediately)
        }
        .background(Palette.bg)
        .task { if !library.isLocalBook(url) { await load() } }
    }

    private var book: Book? { library.book(url) }
    private var title: String { book?.title ?? page?.title ?? "" }

    @ViewBuilder private var header: some View {
        let slug = String(url.split(separator: "/").first ?? "")
        HStack(spacing: 12) {
            PoetAvatar(slug: slug, name: library.nick(slug), size: 52)
            VStack(alignment: .leading, spacing: 2) {
                Text(book?.title ?? page?.title ?? "").font(.ui(19, .bold))
                Text(library.nick(slug) + (book.map { " · \($0.count.fa) شعر" } ?? "")).font(.ui(13)).foregroundStyle(Palette.muted)
            }
        }
        if library.isLocalBook(url) { Note("همه‌ی شعرهای این کتاب با معنیِ ساده‌ی بیت‌به‌بیت.") }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            AppIcon("magnifyingglass").foregroundStyle(Palette.muted)
            TextField("جستجو توی همین کتاب", text: $query).font(.ui(16)).foregroundStyle(Palette.ink)
        }
        .padding(.horizontal, 14).frame(height: 44)
        .background(RoundedRectangle(cornerRadius: 14).fill(Palette.surface))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.line, lineWidth: 1))
    }

    private var localList: some View {
        let q = query.norm
        let poems = library.localPoems(in: url).filter { q.isEmpty || $0.couplets.contains { ($0.m1 + " " + $0.m2).norm.contains(q) } }
        return LazyVStack(spacing: 0) {
            ForEach(Array(poems.enumerated()), id: \.element.url) { i, p in
                tocRow(i + 1, title: p.couplets.first?.m1 ?? p.title, sub: p.couplets.first?.m2 ?? "", count: p.couplets.count, verse: true) { router.openPoem(p.url) }
            }
        }
    }

    private func tocRow(_ n: Int, title: String, sub: String, count: Int?, verse: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(n.fa).font(.ui(12)).foregroundStyle(Palette.muted).frame(width: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(verse ? prefs.verseFont(16) : .ui(15, .medium)).foregroundStyle(Palette.ink).lineLimit(1)
                    if !sub.isEmpty { Text(sub).font(verse ? prefs.verseFont(13) : .ui(12)).foregroundStyle(Palette.muted).lineLimit(1) }
                }
                Spacer(minLength: 0)
                if let count { Text("\(count.fa) بیت").font(.ui(11)).foregroundStyle(Palette.muted) }
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
            .overlay(alignment: .bottom) { Rectangle().fill(Palette.line).frame(height: 1) }
        }
        .buttonStyle(PressStyle(scale: 0.99))
    }

    private func load() async {
        failed = false
        do { page = try await library.category(url) } catch { failed = true }
    }
}
