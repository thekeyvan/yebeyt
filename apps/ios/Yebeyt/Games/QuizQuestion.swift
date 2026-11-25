import Foundation

/// One choice of a quiz: a poet's face (id = slug), a book (id = its path) or a second hemistich (id = its couplet).
struct QuizOption: Hashable, Sendable, Identifiable {
    let id: String
    /// The poet's name, the book's title or the hemistich.
    let title: String
}

/// The part of a recitation that is played in گوش کن: the first hemistich, in seconds from the start of the audio.
struct ListenClip: Equatable, Sendable {
    let audio: URL
    let start: Double
    let end: Double
    /// Seconds before `end` the volume starts falling (`ListenClipRange.fade`, or `measuredFade` for a measured clip).
    var fade = ListenClipRange.fade
}

/// One question of حدس شاعر, مصراع دوم, از کدوم کتاب؟ or گوش کن: a couplet, the options (shuffled) and which is right.
struct QuizQuestion: Equatable, Sendable {
    let kind: GameKind
    let couplet: GameCouplet
    let options: [QuizOption]
    /// The index of the right option.
    let correct: Int
    /// گوش کن: what is played.
    var clip: ListenClip?
    /// گوش کن: the word of the right option «یه کلمه» shows (an index among its words).
    var hintWord: Int?

    var rightOption: QuizOption { options[correct] }

    /// The right second hemistich, when the title can't name the answer (مصراع دوم, گوش کن).
    var rightHemistich: String? { kind == .misra || kind == .listen ? rightOption.title : nil }

    /// The title of the sheet after the answer.
    func verdict(right: Bool) -> String {
        switch kind {
        case .poet: right ? "آره، \(couplet.poetName)!" : "نه، \(couplet.poetName) بود"
        case .book: right ? "آره، از \(rightOption.title) بود!" : "نه، از \(rightOption.title) بود"
        default: right ? "آره، همینه!" : "نه، این بود"
        }
    }
}
