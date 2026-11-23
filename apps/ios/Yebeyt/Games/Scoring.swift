/// The points of the games, in one place (docs/yebeyt-2.md, «Scores before accounts»).
enum Scoring {
    /// The bulb of معمای امروز («یه حرف») costs this much.
    static let dailyHintCost = 30
    /// The bulb of جورچین costs this much.
    static let jigsawHintCost = 20
    /// معمای امروز: 100, 70 or 40 for the first, second or third try.
    static let dailyByTry = [100, 70, 40]
    /// جورچین: points for each word the player placed right.
    static let jigsawWord = 20
    /// جورچین: points for each second left when the round is finished.
    static let jigsawSecondLeft = 1

    /// A solved daily puzzle: by the try it was solved on (1-based), less the hints used; never below zero.
    static func daily(solvedOnTry tryNumber: Int, hints: Int) -> Int {
        guard dailyByTry.indices.contains(tryNumber - 1) else { return 0 }
        return max(0, dailyByTry[tryNumber - 1] - hints * dailyHintCost)
    }

    /// One جورچین couplet: 20 for each word the player placed right, less the hints used; never below zero.
    static func jigsaw(correctWords: Int, hints: Int) -> Int {
        max(0, correctWords * jigsawWord - hints * jigsawHintCost)
    }

    /// The bonus of a round that was finished before the time ran out.
    static func jigsawTimeBonus(secondsLeft: Int) -> Int {
        max(0, secondsLeft) * jigsawSecondLeft
    }

    /// The quiz games (حدس شاعر, مصراع دوم, از کدوم کتاب؟, گوش کن): 20 for a right answer.
    static let quizBase = 20
    /// … and 2 for each second left of the 12 a question gets.
    static let quizSecondLeft = 2
    static let quizWindow = 12
    /// ۵۰:۵۰ and «یه کلمه» cost this much each.
    static let quizHintCost = 20
    /// معنی‌یاب: points for each pair.
    static let matchPair = 10

    /// A right answer of a quiz: 20 and 2 per second left, less the hints used; never below zero.
    static func quiz(secondsLeft: Int, hints: Int) -> Int {
        max(0, quizBase + max(0, secondsLeft) * quizSecondLeft - hints * quizHintCost)
    }
}
