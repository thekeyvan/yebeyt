import SwiftUI

/// The three tries of معمای امروز: a row of letter boxes each, and the «فرصت» line under them.
struct DailyGrid: View {
    let game: DailyGame

    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<DailyGame.maxTries, id: \.self) { row in
                HStack(spacing: 8) {
                    ForEach(0..<game.answer.count, id: \.self) { column in
                        box(row: row, column: column)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("try\(row + 1)")
            }
            legend
        }
        .frame(maxWidth: .infinity)
    }

    private func box(row: Int, column: Int) -> some View {
        let marks = game.marks
        if row < game.tries.count {
            let mark = marks[row][column]
            return cell(String(game.tries[row][column]), fill: color(mark), border: color(mark), text: mark == .grey ? Tokens.Colors.muted : Tokens.Colors.ink)
        }
        guard row == game.tries.count, game.outcome == .playing else { return cell("", fill: .white, border: Tokens.Colors.ring) }
        let letter = game.entry[column]
        let given = game.hinted.contains(column)
        let next = game.cursor == column
        return cell(
            letter.map(String.init) ?? "", fill: given ? Color(hex: 0xD6D8FF) : .white,
            border: letter != nil || next ? Tokens.Colors.lapis : Tokens.Colors.ring, halo: next
        )
    }

    private func cell(_ letter: String, fill: Color, border: Color, text: Color = Tokens.Colors.ink, halo: Bool = false) -> some View {
        Text(letter)
            .font(.ui(22, weight: .bold))
            .foregroundStyle(text)
            .frame(width: 44, height: 50)
            .background {
                RoundedRectangle(cornerRadius: 12).fill(fill)
                RoundedRectangle(cornerRadius: 12).strokeBorder(border, lineWidth: 3)
            }
            .background { if halo { RoundedRectangle(cornerRadius: 15).fill(Color(hex: 0xD6D8FF)).padding(-3) } }
    }

    private func color(_ mark: LetterMark) -> Color {
        switch mark {
        case .green: Tokens.Colors.green
        case .yellow: Tokens.Colors.amber
        case .grey: Tokens.Colors.ring
        }
    }

    /// «فرصت:», a dot for each try (spent, now, still to come) and what the colours mean.
    private var legend: some View {
        HStack(spacing: 6) {
            Text("فرصت:")
            ForEach(0..<DailyGame.maxTries, id: \.self) { index in
                Circle().fill(dot(index)).frame(width: 10, height: 10)
            }
            Text("سبز یعنی سر جاشه، زرد یعنی هست ولی جای دیگه")
        }
        .font(.ui(12))
        .foregroundStyle(Tokens.Colors.muted)
        .accessibilityElement(children: .combine)
    }

    private func dot(_ index: Int) -> Color {
        if index < game.tries.count { return Tokens.Colors.fire }
        return index == game.tries.count && game.outcome == .playing ? Tokens.Colors.lapis : Tokens.Colors.ring
    }
}

/// The letters to build the word from, and «پاک کن». No typing: letters the tries showed to be wrong are greyed.
struct DailyKeyboard: View {
    let keys: [Character]
    let marks: [Character: LetterMark]
    let type: (Character) -> Void
    let erase: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                ForEach(keys.prefix(7), id: \.self, content: key)
            }
            HStack(spacing: 6) {
                ForEach(keys.dropFirst(7), id: \.self, content: key)
                Button(action: erase) {
                    Text("پاک کن").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.fire)
                        .frame(width: 80, height: 42)
                        .sticker(fill: .white, radius: 12, border: 3, shadow: Tokens.Sticker.Shadow.wordOnSheet)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("erase")
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white.opacity(0.6))
            RoundedRectangle(cornerRadius: 22).strokeBorder(Color(hex: 0xC9C5D3), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
        }
    }

    private func key(_ letter: Character) -> some View {
        let mark = marks[letter]
        let used = mark == .grey
        let fill: Color = switch mark {
        case .green: Tokens.Colors.green
        case .yellow: Tokens.Colors.amber
        case .grey: Color(hex: 0xE6E3EC)
        case nil: .white
        }
        return Button { type(letter) } label: {
            Text(String(letter)).font(.ui(20, weight: .bold))
                .foregroundStyle(used ? Color(hex: 0xB9B4C6) : Tokens.Colors.ink)
                .frame(width: used ? 40 : 34, height: used ? 48 : 42)
                .sticker(fill: fill, radius: 12, border: used ? 0 : 3, shadow: used ? ShadowToken(y: 0, blur: 0, opacity: 0) : Tokens.Sticker.Shadow.wordOnSheet)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(String(letter))
        .accessibilityValue(mark == .grey ? "تو کلمه نیست" : mark == .green ? "سر جاشه" : mark == .yellow ? "جای دیگه‌ست" : "")
        .accessibilityIdentifier("key-\(letter)")
    }
}
