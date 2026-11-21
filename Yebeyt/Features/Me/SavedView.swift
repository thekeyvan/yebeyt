import SwiftUI

/// All kept couplets, newest first, as a calm list: search, filter by poet, swipe to remove.
struct SavedView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @State private var query = ""
    @State private var poet: String?

    private var items: [CoupletRef] {
        let q = query.norm.trimmingCharacters(in: .whitespaces)
        return prefs.saved.filter { r in
            guard library.poem(r.url) != nil, let c = library.couplet(r) else { return false }
            if let poet, !r.url.hasPrefix(poet + "/") { return false }
            return q.isEmpty || (c.m1 + " " + c.m2 + " " + c.meaning).norm.contains(q)
        }
    }

    private var poets: [String] {
        var seen: [String] = []
        for r in prefs.saved { let s = String(r.url.split(separator: "/").first ?? ""); if !seen.contains(s) { seen.append(s) } }
        return seen
    }

    var body: some View {
        VStack(spacing: 0) {
            ScreenBar(title: "نگه‌داشته‌ها")
            List {
                Section {
                    if prefs.saved.count > 6 {
                        HStack(spacing: 8) {
                            LineIcon(name: "search", size: 20).foregroundStyle(Palette.muted)
                            TextField("توی نگه‌داشته‌ها بگرد", text: $query).font(.ui(16)).foregroundStyle(Palette.ink)
                        }
                        .padding(.horizontal, 14).frame(height: 44)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Palette.surface))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.line, lineWidth: 1))
                        .listRowSeparator(.hidden)
                    }
                    if poets.count > 1 {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                Chip(title: "همه · \(prefs.saved.count.fa)", selected: poet == nil) { poet = nil }
                                ForEach(poets, id: \.self) { s in
                                    let n = prefs.saved.filter { $0.url.hasPrefix(s + "/") }.count
                                    Chip(title: "\(library.nick(s)) · \(n.fa)", selected: poet == s) { poet = poet == s ? nil : s }
                                }
                            }
                            .padding(.horizontal, 18)
                        }
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 8, trailing: 0))
                        .listRowSeparator(.hidden)
                    }
                }
                .listRowBackground(Color.clear)

                if prefs.saved.isEmpty {
                    EmptyNote(text: "هنوز چیزی نگه نداشتی.\nکارت‌ها رو به راست بکش تا اینجا بیان.")
                        .listRowBackground(Color.clear).listRowSeparator(.hidden)
                } else if items.isEmpty {
                    EmptyNote(text: "چیزی پیدا نشد.")
                        .listRowBackground(Color.clear).listRowSeparator(.hidden)
                } else {
                    ForEach(items) { r in
                        SavedRow(ref: r)
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(Palette.line)
                            .listRowInsets(EdgeInsets(top: 10, leading: 18, bottom: 10, trailing: 18))
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) { withAnimation { _ = prefs.toggleSave(r) } } label: { Label("برداشتن", systemImage: "heart.slash") }
                            }
                            .swipeActions(edge: .leading) {
                                Button { router.show(.share(r.url, r.index)) } label: { Label("استوری", systemImage: "square.and.arrow.up") }.tint(prefs.accent)
                            }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.immediately)
        }
        .background(Palette.bg)
    }
}

/// One kept couplet: a small clear picture, the couplet, and where it's from.
struct SavedRow: View {
    let ref: CoupletRef
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router

    var body: some View {
        if let p = library.poem(ref.url), let c = library.couplet(ref) {
            Button { router.openPoem(ref.url, focus: ref.index) } label: {
                HStack(spacing: 14) {
                    ArtView(ref, text: c.text, painted: true)
                        .frame(width: 48, height: 64)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Palette.line, lineWidth: 1))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(c.m1).font(prefs.verseFont(16)).foregroundStyle(Palette.ink).lineLimit(1)
                        if !c.m2.isEmpty { Text(c.m2).font(prefs.verseFont(16)).foregroundStyle(Palette.ink.opacity(0.85)).lineLimit(1) }
                        Text("\(library.nick(p.poet)) · \(p.title)").font(.ui(12)).foregroundStyle(Palette.muted).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PressStyle(scale: 0.99))
            .contextMenu {
                Button { router.show(.share(ref.url, ref.index)) } label: { Label("استوری", systemImage: "square.and.arrow.up") }
                Button(role: .destructive) { _ = prefs.toggleSave(ref) } label: { Label("برداشتن از دیوان", systemImage: "heart.slash") }
            }
        }
    }
}
