import AVFoundation

/// Where a گوش کن clip stops, and how it fades out. Ganjoor's marks are approximate, so the clip does not run to the
/// start mark of the second hemistich: it stops inside the silence before it, and fades over its last moments.
///
/// Measured on 30 Hafez ghazals (Farahandouz, the first recitation in sync; 204 couplets where the silence between the
/// hemistichs could be found, 20 ms energy windows): the second hemistich starts a median 0.4–0.6 s *before* its mark
/// (a quarter of them 0.65–0.8 s before, a tenth 1–1.3 s before), the silence between the hemistichs is a median
/// 0.2–0.4 s long and lies a median 0.7–1.1 s before the mark, and in about a fifth of the couplets the mark is
/// slightly early instead. A fixed margin of 0.3–0.5 s still plays the next word in half of them; 0.8 s lands inside the
/// silence most often (a third to a half of the couplets) and leaves the next hemistich out in about four of five.
enum ListenClipRange {
    /// How long before the second hemistich's mark the clip stops, in seconds.
    static let margin = 0.8
    /// The clip is never shorter than this (or than the hemistich itself, when that is shorter).
    static let minimumLength = 1.2
    /// The volume falls from full to nothing over this many seconds before the end, so a stray syllable is not heard.
    static let fade = 0.25

    /// The clip's end for a first hemistich read from `start` to the next hemistich's mark `nextMark`.
    static func end(start: Double, nextMark: Double) -> Double {
        min(nextMark, max(nextMark - margin, start + minimumLength))
    }

    /// The part of the audio the fade covers: the last `fade` seconds of the clip, but never before its start.
    static func fadeRange(start: Double, end: Double) -> ClosedRange<Double> {
        max(start, end - fade)...end
    }

    /// The fade as an audio mix for `asset`; nil when the tracks could not be loaded or there is no audio track (the clip
    /// then plays without a fade).
    static func audioMix(for asset: AVAsset, clip: ListenClip) async -> AVAudioMix? {
        guard let track = try? await asset.loadTracks(withMediaType: .audio).first else { return nil }
        let range = fadeRange(start: clip.start, end: clip.end)
        let parameters = AVMutableAudioMixInputParameters(track: track)
        parameters.setVolumeRamp(
            fromStartVolume: 1, toEndVolume: 0,
            timeRange: CMTimeRange(start: AVRecitationEngine.time(range.lowerBound), end: AVRecitationEngine.time(range.upperBound))
        )
        let mix = AVMutableAudioMix()
        mix.inputParameters = [parameters]
        return mix
    }
}
