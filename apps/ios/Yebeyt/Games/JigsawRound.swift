import Foundation

/// A round of جورچین بیت: ten couplets and two minutes for all of them. The clock runs only while a couplet is
/// being played, not while the sheet with its meaning is open.
struct JigsawRound: Equatable, Sendable {
    static let questionCount = 10
    static let duration = 120
    /// «سه تا پشت سر هم درست!» shows after this many right couplets in a row.
    static let comboLength = 3

    /// What one couplet's answer earned and how long it took.
    struct Answer: Equatable, Sendable {
        var result: JigsawBoard.Result
        var seconds: Int
    }

    let questions: [JigsawQuestion]
    private(set) var index = 0
    private(set) var board: JigsawBoard
    /// One answer per couplet played.
    private(set) var answers: [Answer] = []
    private(set) var timeLeft = JigsawRound.duration
    /// The seconds spent on the couplet in front of the player.
    private(set) var secondsOnCurrent = 0

    init?(questions: [JigsawQuestion]) {
        guard let first = questions.first else { return nil }
        self.questions = questions
        board = JigsawBoard(first)
    }

    /// The points of the couplets so far.
    var points: Int { answers.reduce(0) { $0 + $1.result.points } }

    /// Every couplet was answered, so the seconds left count for points.
    var isFinished: Bool { answers.count == questions.count }

    /// The round is over: all couplets are answered, or the time ran out.
    var isOver: Bool { isFinished || timeLeft == 0 }

    var timeBonus: Int { isFinished ? Scoring.jigsawTimeBonus(secondsLeft: timeLeft) : 0 }

    var totalPoints: Int { points + timeBonus }

    var elapsed: Int { Self.duration - timeLeft }

    var rightCount: Int { answers.filter(\.result.isRight).count }

    /// The right couplets in a row, up to the last one answered.
    var combo: Int { answers.reversed().prefix { $0.result.isRight }.count }

    /// The answer whose sheet is open: the couplet is answered but the player has not moved on.
    var sheetOpen: Bool { answers.count > index }

    var lastAnswer: Answer? { sheetOpen ? answers[index] : nil }

    /// The couplet in front of the player, or the one just answered while its sheet is open.
    var current: JigsawQuestion { questions[index] }

    /// One second passes. It only counts while a couplet is being played.
    mutating func tick() {
        guard !isOver, !sheetOpen else { return }
        timeLeft -= 1
        secondsOnCurrent += 1
    }

    /// Mutates the couplet in play: taking stickers, placing, the bulb.
    mutating func edit(_ change: (inout JigsawBoard) -> Void) {
        guard !isOver, !sheetOpen else { return }
        change(&board)
    }

    /// «بچسبون!»: checks the couplet. Nothing happens until every slot is filled.
    @discardableResult
    mutating func check() -> Answer? {
        guard !isOver, !sheetOpen, board.isFull else { return nil }
        let answer = Answer(result: board.check(), seconds: secondsOnCurrent)
        answers.append(answer)
        return answer
    }

    /// «بیت بعدی»: the next couplet. After the last one the round is finished.
    mutating func next() {
        guard sheetOpen, !isFinished else { return }
        index += 1
        board = JigsawBoard(questions[index])
        secondsOnCurrent = 0
    }
}
