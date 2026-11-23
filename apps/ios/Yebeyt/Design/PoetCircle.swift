import SwiftUI

/// A poet's picture: the real one from the server when the phone has it, else a sticker circle in the poet's
/// colour with the first letter of their name. The avatar is always a circle.
struct PoetCircle: View {
    @Environment(PoetPictures.self) private var pictures: PoetPictures?
    let poet: LibraryPoet
    var size: CGFloat = 70
    var border: CGFloat = 4
    var borderColor = Tokens.Colors.white
    /// On the poet's own card the circle is a shade darker than the card.
    var onCard = false

    var body: some View {
        Circle()
            .fill(onCard ? poet.color.poetCardCircle : poet.color.poetCircle)
            .overlay {
                if let image = pictures?.images[poet.slug] {
                    Image(uiImage: image).resizable().scaledToFill().clipShape(Circle())
                } else {
                    Text(poet.initial)
                        .font(.title(size * 0.5, scaled: false))
                        .foregroundStyle(Tokens.Colors.white)
                        .padding(.top, size * 0.1)
                }
            }
            .overlay(Circle().strokeBorder(borderColor, lineWidth: border))
            .frame(width: size, height: size)
            .shadow(color: (onCard ? Color(red: 0.04, green: 0.04, blue: 0.24) : Tokens.Colors.ink).opacity(onCard ? 0.3 : 0.22), radius: onCard ? 5 : 4, x: 0, y: onCard ? 3 : 2)
            .accessibilityHidden(true)
            .task(id: pictures?.versions[poet.slug]) { await pictures?.load(slug: poet.slug) }
    }
}

/// A poet's circle with the name under it: a fixed-width label that wraps to a second line (long names),
/// while the picture stays a circle.
struct PoetTile: View {
    let poet: LibraryPoet

    var body: some View {
        VStack(spacing: 5) {
            PoetCircle(poet: poet)
            Text(poet.name)
                .font(.ui(12, weight: .bold))
                .foregroundStyle(Tokens.Colors.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .lineSpacing(3)
                .frame(width: 76, alignment: .top)
                .padding(.bottom, 2)
        }
        .frame(width: 76)
        .accessibilityElement(children: .combine)
    }
}

/// A book cover with its title (up to two lines) and the poet's name under it.
struct BookTile: View {
    let book: LibraryBook
    let poetName: String
    var titleSize: CGFloat = 15

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            BookCover(color: book.color)
            Text(book.title)
                .font(.title(titleSize))
                .foregroundStyle(Tokens.Colors.ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Text(poetName)
                .font(.ui(12))
                .foregroundStyle(Tokens.Colors.muted)
                .lineLimit(1)
                .padding(.top, -4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
