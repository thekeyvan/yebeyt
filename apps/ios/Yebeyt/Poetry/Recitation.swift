import Foundation

/// One recitation of a poem from Ganjoor's API (`/api/ganjoor/poem/{poemId}/recitations`).
/// Only the fields we use are decoded.
struct Recitation: Decodable, Hashable, Sendable, Identifiable {
    var id: Int
    var audioArtist: String
    var mp3Url: URL
    /// The timing file that syncs the audio to the text; nil when there is none.
    var xmlUrl: URL?
    var inSyncWithText: Bool
    var audioOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, audioArtist, mp3Url, xmlUrl, inSyncWithText, audioOrder
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(Int.self, forKey: .id)
        audioArtist = try values.decode(String.self, forKey: .audioArtist)
        mp3Url = try values.decode(URL.self, forKey: .mp3Url)
        xmlUrl = try values.decodeIfPresent(String.self, forKey: .xmlUrl).flatMap { $0.isEmpty ? nil : URL(string: $0) }
        inSyncWithText = try values.decode(Bool.self, forKey: .inSyncWithText)
        audioOrder = try values.decode(Int.self, forKey: .audioOrder)
    }
}
