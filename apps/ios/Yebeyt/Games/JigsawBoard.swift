import Foundation

/// The couplet being played: which sticker sits in which slot, which one is in the hand, and what the bulb gave.
struct JigsawBoard: Equatable, Sendable {
    /// What checking a couplet found.
    struct Result: Equatable, Sendable {
        /// The words the player placed right (not counting the bulb's).
        var correctWords: Int
        var hints: Int
        var isRight: Bool
        var points: Int
    }

    /// How a slot reads once the couplet is checked.
    enum SlotMark: Equatable, Sendable {
        /// A word the couplet gave from the start.
        case given
        /// The bulb's word.
        case hinted
        /// The player's sticker has the right word.
        case right
        /// The player's sticker has another word.
        case wrong
    }

    let question: JigsawQuestion
    /// Slot position → the sticker in it.
    private(set) var placed: [Int: JigsawSticker] = [:]
    /// The positions the bulb filled. They stay.
    private(set) var hinted: Set<Int> = []
    /// The sticker in the hand: tapped, waiting for a slot.
    private(set) var selected: JigsawSticker?
    /// The order of the sheet.
    private(set) var order: [JigsawSticker]

    init(_ question: JigsawQuestion) {
        self.question = question
        order = question.stickers
    }

    /// The stickers still on the sheet, in its order.
    var onSheet: [JigsawSticker] { order.filter { sticker in !placed.values.contains(sticker) } }

    /// Whether the slot at this position is filled: given from the start, by the bulb or by a sticker.
    func isFilled(_ position: Int) -> Bool {
        !question.missing.contains(position) || placed[position] != nil
    }

    /// The word shown in a slot: the given word, or the placed sticker's; nil for an empty slot.
    func word(at position: Int) -> String? {
        question.missing.contains(position) ? placed[position]?.word : question.words[position]
    }

    /// What the slot at this position shows once the couplet is checked. Words count by their text, as `check` does.
    func mark(at position: Int) -> SlotMark {
        guard question.missing.contains(position) else { return .given }
        if hinted.contains(position) { return .hinted }
        return placed[position]?.word == question.words[position] ? .right : .wrong
    }

    var isFull: Bool { question.missing.allSatisfy { placed[$0] != nil } }

    var canHint: Bool { hintPosition != nil }

    /// Takes a sticker in hand; taking the one in hand puts it down.
    mutating func select(_ sticker: JigsawSticker) {
        selected = selected == sticker ? nil : sticker
    }

    /// A tap on a slot: puts the sticker in hand there; with nothing in hand, takes the slot's sticker back to the sheet.
    mutating func tapSlot(_ position: Int) {
        if let selected {
            place(selected, at: position)
        } else {
            remove(at: position)
        }
    }

    /// Puts a sticker in a slot that waits for one (a slot the bulb filled stays). A sticker already there goes back to the sheet.
    mutating func place(_ sticker: JigsawSticker, at position: Int) {
        guard question.missing.contains(position), !hinted.contains(position) else { return }
        for (slot, other) in placed where other == sticker { placed[slot] = nil }
        placed[position] = sticker
        selected = nil
    }

    /// Takes a sticker back to the sheet.
    mutating func remove(at position: Int) {
        guard !hinted.contains(position) else { return }
        placed[position] = nil
    }

    /// Mixes the stickers on the sheet.
    mutating func shuffle(using generator: inout SeededGenerator) {
        order = generator.shuffled(order)
    }

    /// The bulb: puts the right word in the first slot that is empty or wrong.
    @discardableResult
    mutating func hint() -> Bool {
        guard let position = hintPosition else { return false }
        let word = question.words[position]
        // A sticker with that word that is not already holding a slot for the bulb: one on the sheet, else one placed in a wrong slot.
        let candidates = question.stickers.filter { sticker in word == sticker.word && !hinted.contains { placed[$0] == sticker } }
        guard let sticker = candidates.first(where: { !placed.values.contains($0) }) ?? candidates.first else { return false }
        for (slot, other) in placed where other == sticker { placed[slot] = nil }
        placed[position] = sticker
        hinted.insert(position)
        selected = nil
        return true
    }

    /// Looks at the placed stickers. Slots count by their word, so two stickers with the same word are the same.
    func check() -> Result {
        let right = question.missing.filter { placed[$0]?.word == question.words[$0] }
        let correct = right.filter { !hinted.contains($0) }.count
        return Result(
            correctWords: correct, hints: hinted.count, isRight: right.count == question.missing.count,
            points: Scoring.jigsaw(correctWords: correct, hints: hinted.count)
        )
    }

    private var hintPosition: Int? {
        question.missing.first { !hinted.contains($0) && placed[$0]?.word != question.words[$0] }
    }
}
