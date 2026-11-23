import AVFoundation

/// What starting a game clip asks of a player: seek, then play.
@MainActor protocol ClipTransport {
    /// Seeks to `seconds`; false when another seek cut this one short.
    func seek(to seconds: Double) async -> Bool
    func play()
}

enum ClipStart {
    /// Seeks to the start of the clip and plays only when that seek is done and the player is still wanted (it was not
    /// stopped, replaced or cut short meanwhile). Playing first would let the audio begin at the wrong place.
    @MainActor static func run(_ transport: some ClipTransport, at start: Double, stillWanted: @MainActor () -> Bool) async {
        guard await transport.seek(to: start), stillWanted() else { return }
        transport.play()
    }

    /// Whether the clip should start playing once its seek is done: the same player and start, and still «playing» (a
    /// pause, a stop or a new start while it loaded wins; the seek is still done, so a resume plays from the clip's start).
    static func shouldPlay(generation: Int, started: Int, samePlayer: Bool, state: RecitationPlayer.State) -> Bool {
        generation == started && samePlayer && state == .playing
    }
}

/// The real thing: an AVPlayer, seeking with no tolerance.
@MainActor struct AVClipTransport: ClipTransport {
    let player: AVPlayer

    func seek(to seconds: Double) async -> Bool {
        await player.seek(to: CMTime(seconds: seconds, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }

    func play() {
        player.play()
    }
}
