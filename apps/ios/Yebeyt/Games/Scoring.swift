/// The points of the games, in one place (docs/yebeyt-2.md, «Scores before accounts»).
enum Scoring {
    /// A hint (the bulb) costs this much in every game.
    static let hintCost = 20
    /// معمای امروز: 100, 70 or 40 for the first, second or third try.
    static let dailyByTry = [100, 70, 40]
    /// جورچین: points for each word the player placed right.
    static let jigsawWord = 20
    /// جورچین: points for each second left when the round is finished.
    static let jigsawSecondLeft = 1

    /// A solved daily puzzle: by the try it was solved on (1-based), less the hints used; never below zero.
    static func daily(solvedOnTry tryNumber: Int, hints: Int) -> Int {
        guard dailyByTry.indices.contains(tryNumber - 1) else { return 0 }
        return max(0, dailyByTry[tryNumber - 1] - hints * hintCost)
    }

    /// One جورچین couplet: 20 for each word the player placed right, less the hints used; never below zero.
    static func jigsaw(correctWords: Int, hints: Int) -> Int {
        max(0, correctWords * jigsawWord - hints * hintCost)
    }

    /// The bonus of a round that was finished before the time ran out.
    static func jigsawTimeBonus(secondsLeft: Int) -> Int {
        max(0, secondsLeft) * jigsawSecondLeft
    }
}
