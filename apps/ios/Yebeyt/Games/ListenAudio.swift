import Foundation
import Observation

/// The sound of گوش کن: one player for the clip of the question in play. It starts at once, pauses and resumes, and can
/// be started again from the beginning of the clip. `progress` follows the player's own position.
@MainActor @Observable
final class ListenAudio {
    private(set) var player: RecitationPlayer?
    private var clip: ListenClip?
    /// The recitation could not be played («خوانش باز نشد»).
    @ObservationIgnored var onFailure: (@MainActor () -> Void)?

    var isPlaying: Bool { player?.isPlaying == true }

    /// Nothing is playing or loading (not started, finished, or stopped).
    var isIdle: Bool { player?.state ?? .idle == .idle }

    /// How far the clip has played, 0 to 1.
    var progress: Double {
        guard let clip, let player else { return 0 }
        return min(1, max(0, (player.position - clip.start) / max(clip.end - clip.start, 0.1)))
    }

    /// Lets go of the last clip and plays this one from its start; nil only stops.
    func start(_ clip: ListenClip?) {
        player?.stop()
        player = nil
        self.clip = clip
        guard let clip else { return }
        let player = RecitationPlayer(clip: clip, title: GameKind.listen.name, onFailure: { [weak self] in self?.onFailure?() })
        self.player = player
        player.toggle()
    }

    /// Pause, resume, or (while loading) give up loading.
    func toggle() {
        player?.toggle()
    }

    /// The clip again from its start.
    func restart() {
        start(clip)
    }

    func stop() {
        player?.stop()
    }
}
