#if DEBUG
import Foundation

extension ReaderMarks {
    /// `-beytSeedDivan 1`: keeps couplets of the bundled books (so they show offline) kept on different days, for
    /// screenshots of the divan and the profile.
    func seedDivan(now: Date = .now) {
        let hafez = [("sh1", 0), ("sh1", 2), ("sh3", 0), ("sh3", 1), ("sh3", 5), ("sh2", 0), ("sh2", 3), ("sh4", 0), ("sh4", 2), ("sh5", 0), ("sh6", 0), ("sh7", 1)]
        var keys = hafez.map { "/hafez/ghazal/\($0.0)#\($0.1)" }
        keys += (1...5).map { "/khayyam/robaee/sh\($0)#0" }
        keys += [("sh1", 0), ("sh2", 0), ("sh3", 1)].map { "/babataher/2beytiha/\($0.0)#\($0.1)" }
        let daysAgo = [0, 1, 1, 2, 3, 6, 9, 12, 15, 20]
        apply(keys.enumerated().map { offset, key in
            let day = daysAgo[offset % daysAgo.count]
            let date = now.addingTimeInterval(-Double(day) * 86_400 - Double(offset) * 60)
            return DivanItem(key: key, keptAt: DivanTime.milliseconds(of: date), removedAt: nil)
        })
    }
}
#endif
