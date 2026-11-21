import SwiftUI

struct SearchView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @State private var query = ""
    @State private var hits: [Hit] = []
    @FocusState private var focused: Bool

    struct Hit: Identifiable, Hashable { let ref: CoupletRef; let inText: Bool; var id: String { ref.key } }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                BackButton()
                HStack(spacing: 8) {
                    AppIcon("magnifyingglass").foregroundStyle(Palette.muted)
                    TextField("شاعر، کتاب، یه کلمه از شعر، یا یه حس…", text: $query)
                        .font(.ui(16)).foregroundStyle(Palette.ink)
                        .focused($focused).submitLabel(.search)
                    if !query.isEmpty {
                        Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Palette.muted) }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14).frame(height: 44)
                .background(RoundedRectangle(cornerRadius: 14).fill(Palette.surface))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(focused ? Palette.lapis : Palette.line, lineWidth: 1))
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    if query.norm.trimmingCharacters(in: .whitespaces).isEmpty { idle } else { results }
                }
                .pagePadding().padding(.top, 10).padding(.bottom, 40)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.immediately)
        }
        .background(Palette.bg)
        .task(id: "\(query)|\(library.searchIndex.count)") {
            let q = query.norm.trimmingCharacters(in: .whitespaces)
            guard q.count >= 2 else { hits = []; return }
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            let index = library.searchIndex
            let found = await Task.detached { SearchView.search(q, in: index) }.value
            if !Task.isCancelled { hits = found }
        }
        .onAppear {
            #if DEBUG
            if let q = UserDefaults.standard.string(forKey: "beytQuery"), query.isEmpty { query = q; return }
            #endif
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { focused = true }
        }
    }

    nonisolated private static func search(_ q: String, in index: [SearchEntry]) -> [Hit] {
        var text: [Hit] = [], meaning: [Hit] = []
        for e in index {
            if e.text.contains(q) { text.append(Hit(ref: CoupletRef(e.url, e.index), inText: true)) }
            else if meaning.count < 60, e.meaning.contains(q) { meaning.append(Hit(ref: CoupletRef(e.url, e.index), inText: false)) }
            if text.count >= 60 { return text }
        }
        return Array((text + meaning).prefix(60))
    }

    private var idle: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle("شاعرها")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        ForEach(library.poets.filter { $0.pin > 0 }.sorted { $0.pin < $1.pin }.prefix(10)) { p in
                            Button { router.show(.poet(p.slug)) } label: {
                                VStack(spacing: 6) {
                                    PoetAvatar(slug: p.slug, name: p.nick, size: 60)
                                    Text(p.nick).font(.ui(13, .medium)).foregroundStyle(Palette.ink).lineLimit(1)
                                }
                                .frame(width: 72)
                            }
                            .buttonStyle(PressStyle())
                        }
                    }
                    .padding(.horizontal, 18)
                }
                .padding(.horizontal, -18)
            }
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle("کتاب‌های معروف")
                FlowLayout {
                    ForEach([("hafez/ghazal", "دیوان حافظ"), ("moulavi/masnavi", "مثنوی معنوی"), ("ferdousi/shahname", "شاهنامه"), ("saadi/golestan", "گلستان"), ("khayyam/robaee", "رباعیات خیام"), ("moulavi/shams", "دیوان شمس")], id: \.0) { b in
                        Chip(title: b.1) { router.open(.book(b.0)) }
                    }
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle("حال‌وهوا")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) { ForEach(Content.moods) { MoodTile(mood: $0) } }.padding(.horizontal, 18)
                }
                .padding(.horizontal, -18)
            }
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle("امتحان کن")
                FlowLayout {
                    ForEach(["جدایی", "غم مخور", "کوزه", "دوستی", "خرد"], id: \.self) { s in Chip(title: s) { query = s } }
                }
            }
            Note("جستجوی متن و معنی روی همه‌ی شعرهای داخل اپه (دیوان حافظ، خیام، باباطاهر و چند شعر گزیده). بقیه‌ی کتاب‌ها رو از کتابخانه باز کن.")
        }
    }

    @ViewBuilder private var results: some View {
        let q = query.norm.trimmingCharacters(in: .whitespaces)
        let poets = library.poets.filter { ($0.nick + " " + $0.fullName + " " + $0.slug).norm.contains(q) }.prefix(10)
        let books = library.allBooks.filter { ($0.title + " " + library.nick($0.poet)).norm.contains(q) }.prefix(8)
        let moods = Content.moods.filter { $0.title.norm.contains(q) }
        if poets.isEmpty && books.isEmpty && moods.isEmpty && hits.isEmpty {
            EmptyNote(text: "چیزی برای «\(query)» پیدا نشد.\nاسم یه شاعر یا کلمه‌ای مثل «جدایی» رو امتحان کن.")
        }
        if !poets.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Eyebrow("شاعر")
                ForEach(Array(poets)) { p in
                    IconRow(title: p.nick, subtitle: "\(p.fullName) · \(p.poemCount.fa) شعر") { PoetAvatar(slug: p.slug, name: p.nick, size: 44) } action: { router.show(.poet(p.slug)) }
                }
            }
        }
        if !moods.isEmpty {
            FlowLayout { ForEach(moods) { m in Chip(title: "حال‌وهوای «\(m.title)»") { router.open(.mood(m.key)) } } }
        }
        if !books.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Eyebrow("کتاب")
                ForEach(Array(books)) { b in
                    IconRow(title: b.title, subtitle: "\(library.nick(b.poet)) · \(b.count.fa) شعر") { IconSquare(icon: "book") } action: { router.open(.book(b.url)) }
                }
            }
        }
        if !hits.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Eyebrow("بیت · \(hits.count.fa)\(hits.count >= 60 ? "+" : "")")
                ForEach(hits.prefix(30)) { h in
                    if let p = library.poem(h.ref.url), let c = library.couplet(h.ref) {
                        Button { router.openPoem(h.ref.url, focus: h.ref.index) } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                CoupletLines(couplet: c, base: 17)
                                if !h.inText { Text("معنی: " + c.meaning.firstSentences(1)).font(.ui(13)).foregroundStyle(Palette.muted).lineLimit(2) }
                                HStack(spacing: 8) {
                                    PoetAvatar(slug: p.poet, name: library.nick(p.poet), size: 22)
                                    Text("\(library.nick(p.poet)) · \(p.title)").font(.ui(12)).foregroundStyle(Palette.muted)
                                }
                            }
                            .card()
                        }
                        .buttonStyle(PressStyle(scale: 0.99))
                    }
                }
            }
        }
    }
}
