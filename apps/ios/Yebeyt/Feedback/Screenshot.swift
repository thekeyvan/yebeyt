import UIKit

/// The picture of the screen taken just before the feedback sheet opens. It stays in memory until it is sent or closed.
enum ScreenshotCapture {
    /// The app's key window as it is now (the keyboard and system parts are not in it), with a blank over every private
    /// view (`.feedbackPrivate()`), painted after the window is drawn so no typed text or message is in the picture.
    @MainActor static func keyWindow() -> UIImage? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let window = scenes.flatMap(\.windows).first(where: \.isKeyWindow) else { return nil }
        let rects = FeedbackPrivacy.shared.rects(in: window)
        #if DEBUG
        FeedbackPrivacy.shared.recordRedaction(rects)
        #endif
        let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
        return renderer.image { context in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
            PrivateBlank.paint(rects, in: context.cgContext)
        }
    }
}

/// The picture that is sent: a JPEG of about 0.8 quality, at most 1600 points on its long side and under the
/// server's 3 MB.
enum ScreenshotEncoder {
    static let longSide: CGFloat = 1600
    static let maxBytes = 3_000_000

    static func jpeg(from image: UIImage, longSide: CGFloat = longSide, maxBytes: Int = maxBytes) -> Data? {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let shrink = min(1, longSide / max(pixels.width, pixels.height))
        let target = CGSize(width: (pixels.width * shrink).rounded(), height: (pixels.height * shrink).rounded())
        guard target.width >= 1, target.height >= 1 else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let small = UIGraphicsImageRenderer(size: target, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        var quality: CGFloat = 0.8
        while quality > 0.2 {
            if let data = small.jpegData(compressionQuality: quality), data.count <= maxBytes { return data }
            quality -= 0.2
        }
        return nil
    }
}

/// The marks drawn on a screenshot in the editor: ink lines and solid ink rectangles. Positions are fractions of the
/// picture (0...1), so the same marks fit the picture at any size.
struct ScreenshotMarkup: Equatable {
    enum Mark: Equatable {
        case line([CGPoint])
        case cover(CGRect)
    }

    private(set) var marks: [Mark] = []

    var isEmpty: Bool { marks.isEmpty }

    mutating func add(_ mark: Mark) { marks.append(mark) }
    mutating func undo() { if !marks.isEmpty { marks.removeLast() } }

    /// A line is as thick as 0.7% of the picture's long side.
    static let lineWidth: CGFloat = 0.007

    /// The screenshot with the marks drawn on it: what is sent.
    func render(on image: UIImage) -> UIImage {
        guard !marks.isEmpty else { return image }
        let size = image.size
        let format = UIGraphicsImageRendererFormat()
        format.scale = image.scale
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            image.draw(at: .zero)
            let cg = context.cgContext
            let ink = UIColor(red: 0x14 / 255, green: 0x11 / 255, blue: 0x2B / 255, alpha: 1)  // Tokens.Colors.ink
            cg.setStrokeColor(ink.cgColor)
            cg.setFillColor(ink.cgColor)
            let width = Self.lineWidth * max(size.width, size.height)
            cg.setLineWidth(width)
            cg.setLineCap(.round)
            cg.setLineJoin(.round)
            func scaled(_ point: CGPoint) -> CGPoint { CGPoint(x: point.x * size.width, y: point.y * size.height) }
            for mark in marks {
                switch mark {
                case .line(let points):
                    guard let first = points.first else { continue }
                    if points.count == 1 {
                        let dot = scaled(first)
                        let radius = width / 2
                        cg.fillEllipse(in: CGRect(x: dot.x - radius, y: dot.y - radius, width: radius * 2, height: radius * 2))
                    } else {
                        cg.move(to: scaled(first))
                        points.dropFirst().forEach { cg.addLine(to: scaled($0)) }
                        cg.strokePath()
                    }
                case .cover(let rect):
                    cg.fill(CGRect(x: rect.minX * size.width, y: rect.minY * size.height, width: rect.width * size.width, height: rect.height * size.height))
                }
            }
        }
    }
}
