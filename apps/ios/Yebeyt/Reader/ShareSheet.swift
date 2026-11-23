import SwiftUI
import UIKit

/// The iOS share sheet, for a text or for any items (the story's image).
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    init(text: String) {
        items = [text]
    }

    init(items: [Any]) {
        self.items = items
    }

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
