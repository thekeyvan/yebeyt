import Foundation

/// The words under the title of a quiz game's screen (the boards' second line).
enum QuizCopy {
    static func subtitle(for kind: GameKind, poetName: String) -> String {
        switch kind {
        case .poet: "شاعرِ این بیت کیه؟"
        case .misra: "ادامه‌ی این بیت کدومه؟"
        case .book: "این بیت از کدوم کتابِ \(poetName)\(copula(poetName))؟"
        case .listen: "مصراع اول رو بشنو؛ دومی کدومه؟"
        default: ""
        }
    }

    /// The spoken «است» after a name: «مولانا» → «ست» (مولاناست), «حافظ» → «ه» (حافظه).
    static func copula(_ name: String) -> String {
        guard let last = name.last else { return "" }
        return last == "ا" || last == "و" ? "ست" : "ه"
    }
}
