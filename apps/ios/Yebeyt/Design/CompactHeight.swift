import SwiftUI

/// One rule for "this screen is too short for the board's sizes": they need about 700 pt between the status bar and the
/// home indicator, and below that (an iPhone SE is 667 pt tall, 647 under its status bar) a screen sets itself tighter.
enum CompactHeight {
    static let below: CGFloat = 700

    /// `height` is the one the screen has inside the safe area.
    static func isCompact(_ height: CGFloat) -> Bool { height < below }
}
