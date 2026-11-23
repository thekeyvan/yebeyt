import Foundation

/// One hard word of a couplet and what it means. `m` is the hemistich (1 or 2); `text` is one or more whole words of it.
struct GlossaryWord: Decodable, Equatable, Sendable {
    var text: String
    var m: Int
    var gloss: String
}

/// The hard words of one couplet; `couplet` is 0-based, as in the reader.
struct GlossaryEntry: Decodable, Equatable, Sendable, Identifiable {
    var path: String
    var couplet: Int
    var words: [GlossaryWord]

    var id: String { "\(path)#\(couplet)" }
}

/// glossary.json, written by `tools/ganjoor/build.py`: it checked that every word is in its couplet. معنی‌یاب plays
/// it and the reader will use the same file for the dotted words.
struct Glossary: Sendable {
    private struct File: Decodable {
        var entries: [GlossaryEntry]
    }

    let entries: [GlossaryEntry]

    /// Reads glossary.json from the bundle; throws if it is missing or unreadable.
    init(bundle: Bundle = .main) throws {
        guard let url = bundle.url(forResource: "glossary", withExtension: "json") else {
            throw PoetryError.missingResource("glossary")
        }
        entries = try JSONDecoder().decode(File.self, from: Data(contentsOf: url)).entries
    }
}

/// Finding glossed words in a hemistich: text is matched after normalisation (no diacritics, ي→ی, ك→ک, half-space
/// → space), whole words only.
enum GlossMatch {
    /// The words of the hemistich as written, and for each text the range of words it covers (nil when it is not there).
    static func locate(_ texts: [String], in hemistich: String) -> (tokens: [String], ranges: [Range<Int>?]) {
        let tokens = hemistich.split(whereSeparator: \.isWhitespace).map(String.init)
        // A written word can hold several normalised ones («گل‌گشت»): each remembers the written word it is part of.
        var flat: [(word: String, token: Int)] = []
        for (index, token) in tokens.enumerated() {
            for word in TextNormalizer.normalize(token).split(separator: " ") { flat.append((String(word), index)) }
        }
        let ranges = texts.map { text -> Range<Int>? in
            let wanted = TextNormalizer.normalize(text).split(separator: " ").map(String.init)
            guard !wanted.isEmpty, wanted.count <= flat.count else { return nil }
            for start in 0...(flat.count - wanted.count) where wanted.indices.allSatisfy({ flat[start + $0].word == wanted[$0] }) {
                return flat[start].token..<(flat[start + wanted.count - 1].token + 1)
            }
            return nil
        }
        return (tokens, ranges)
    }
}
