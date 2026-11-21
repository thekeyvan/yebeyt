import UIKit
import CoreText

/// The eleven scenes. Each couplet gets its own composition of one of them (seeded from its text).
enum ArtScene: String, CaseIterable, Sendable {
    case moon, cup, jug, ring, ney, sun, feather, candle, cups, mountain, rose
    var hue: Double {
        switch self {
        case .moon: 222
        case .cup: 345
        case .jug: 26
        case .ring: 160
        case .ney: 268
        case .sun: 38
        case .feather: 14
        case .candle: 34
        case .cups: 28
        case .mountain: 195
        case .rose: 340
        }
    }
}

/// Seeded random numbers (same algorithm family as the prototype: FNV hash + mulberry32).
struct SeededRandom {
    private var a: UInt32
    init(_ s: String) {
        var h: UInt32 = 2166136261
        for u in s.unicodeScalars { h ^= u.value & 0xFFFF; h = h &* 16777619 }
        a = h == 0 ? 1 : h
    }
    mutating func next() -> Double {
        a = a &+ 0x6D2B79F5
        var t = (a ^ (a >> 15)) &* (1 | a)
        t = (t &+ ((t ^ (t >> 7)) &* (61 | t))) ^ t
        return Double(t ^ (t >> 14)) / 4294967296
    }
}

/// Draws type-art: a scene made out of the couplet's own letters, or the clean "painted" scene.
enum SceneArt {
    private static let cache = NSCache<NSString, UIImage>()

    static func cacheKey(scene: ArtScene, seed: String, size: CGSize, painted: Bool) -> String {
        "\(scene.rawValue)|\(seed.hashValue)|\(Int(size.width))x\(Int(size.height))|\(painted)"
    }

    static func cached(scene: ArtScene, seed: String, size: CGSize, painted: Bool) -> UIImage? {
        cache.object(forKey: cacheKey(scene: scene, seed: seed, size: size, painted: painted) as NSString)
    }

    static func image(scene: ArtScene, seed: String, text: String, size: CGSize, painted: Bool, scale: CGFloat = 2) -> UIImage {
        let key = cacheKey(scene: scene, seed: seed, size: size, painted: painted) as NSString
        if let img = cache.object(forKey: key) { return img }
        let img = render(scene: scene, seed: seed, text: text, size: size, painted: painted, scale: scale)
        cache.setObject(img, forKey: key)
        return img
    }

    // MARK: - render

    private static func render(scene: ArtScene, seed: String, text: String, size: CGSize, painted: Bool, scale: CGFloat) -> UIImage {
        let w = max(1, size.width.rounded()), h = max(1, size.height.rounded())
        var bg = SeededRandom("bg|" + seed)
        let hue = scene.hue + (bg.next() * 24 - 12).rounded()
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = scale
        fmt.opaque = true
        let mask = sceneMask(scene: scene, seed: seed, w: w, h: h, scale: scale)
        return UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: fmt).image { ctx in
            let g = ctx.cgContext
            g.setFillColor(UIColor(red: 12 / 255, green: 12 / 255, blue: 15 / 255, alpha: 1).cgColor)
            g.fill(CGRect(x: 0, y: 0, width: w, height: h))
            // Soft colour glows behind the scene.
            let glows: [(Double, Double, Double, Double)] = [(0.18, 0.2, hue, 0.55), (0.85, 0.18, hue + 32, 0.42), (0.7, 0.7, hue - 28, 0.5), (0.25, 0.78, hue + 170, 0.16)]
            let space = CGColorSpaceCreateDeviceRGB()
            for (x0, y0, hh, a) in glows {
                let x = x0 + (bg.next() - 0.5) * 0.3, y = y0 + (bg.next() - 0.5) * 0.3
                let r = max(w, h) * 0.6
                let c0 = hsla(hh, 72, 46, a), c1 = UIColor(white: 0, alpha: 0).cgColor
                if let grad = CGGradient(colorsSpace: space, colors: [c0, c1] as CFArray, locations: [0, 1]) {
                    g.drawRadialGradient(grad, startCenter: CGPoint(x: x * w, y: y * h), startRadius: 0, endCenter: CGPoint(x: x * w, y: y * h), endRadius: r, options: [.drawsAfterEndLocation])
                }
            }
            if painted {
                drawPainted(g, mask: mask, w: w, h: h, hue: hue)
            } else {
                drawLetters(g, mask: mask, text: text, w: w, h: h, hue: hue)
            }
        }
    }

    private static func hsla(_ h: Double, _ s: Double, _ l: Double, _ a: Double) -> CGColor {
        let (r, g, b) = hslToRGB(h, s, l)
        return UIColor(red: r, green: g, blue: b, alpha: a).cgColor
    }

    private struct Mask { let image: CGImage; let data: [UInt8]; let pw: Int; let ph: Int; let scale: CGFloat }

    /// White scene shapes on transparent, plus the alpha values for sampling.
    private static func sceneMask(scene: ArtScene, seed: String, w: CGFloat, h: CGFloat, scale: CGFloat) -> Mask {
        let pw = Int(w * scale), ph = Int(h * scale)
        var data = [UInt8](repeating: 0, count: pw * ph * 4)
        let space = CGColorSpaceCreateDeviceRGB()
        let image: CGImage = data.withUnsafeMutableBytes { buf -> CGImage in
            let g = CGContext(data: buf.baseAddress, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: pw * 4, space: space,
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            g.translateBy(x: 0, y: CGFloat(ph))
            g.scaleBy(x: scale, y: -scale)
            drawScene(g, scene: scene, w: w, h: h, seed: seed)
            return g.makeImage()!
        }
        return Mask(image: image, data: data, pw: pw, ph: ph, scale: scale)
    }

    private static func alpha(_ m: Mask, _ x: CGFloat, _ y: CGFloat) -> Double {
        let px = min(m.pw - 1, max(0, Int(x * m.scale))), py = min(m.ph - 1, max(0, Int(y * m.scale)))
        return Double(m.data[(py * m.pw + px) * 4 + 3]) / 255
    }

    private static func drawPainted(_ g: CGContext, mask: Mask, w: CGFloat, h: CGFloat, hue: Double) {
        // Gradient fill clipped to the scene, then drawn twice: once with a glow, once crisp.
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = mask.scale
        let tinted = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: fmt).image { c in
            let t = c.cgContext
            UIImage(cgImage: mask.image, scale: mask.scale, orientation: .up).draw(in: CGRect(x: 0, y: 0, width: w, height: h))
            t.setBlendMode(.sourceIn)
            let space = CGColorSpaceCreateDeviceRGB()
            if let grad = CGGradient(colorsSpace: space, colors: [hsla(hue + 20, 95, 82, 1), hsla(hue, 85, 58, 1), hsla(hue - 20, 70, 38, 1)] as CFArray, locations: [0, 0.6, 1]) {
                t.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: h), options: [])
            }
        }
        g.saveGState()
        g.setShadow(offset: .zero, blur: 36, color: hsla(hue, 100, 60, 0.9))
        tinted.draw(in: CGRect(x: 0, y: 0, width: w, height: h))
        g.restoreGState()
        tinted.draw(in: CGRect(x: 0, y: 0, width: w, height: h))
    }

    private static let letterFont: CTFont = {
        let base = UIFont(name: "Vazirmatn-Regular", size: 12) ?? UIFont.systemFont(ofSize: 12, weight: .bold)
        let wght = 2003265652 // 'wght'
        let desc = CTFontDescriptorCreateCopyWithAttributes(base.fontDescriptor as CTFontDescriptor,
                                                            [kCTFontVariationAttribute: [wght: 700]] as CFDictionary)
        return CTFontCreateWithFontDescriptor(desc, 12, nil)
    }()

    private static func drawLetters(_ g: CGContext, mask: Mask, text: String, w: CGFloat, h: CGFloat, hue: Double) {
        let skip = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "\u{200C}«»،.؟!:؛()-")).union(.nonBaseCharacters)
        var chars = text.unicodeScalars.filter { !skip.contains($0) }.map { UniChar(truncatingIfNeeded: $0.value) }
        if chars.isEmpty { chars = [UniChar(0x0628)] }
        let cell: CGFloat = w > 240 ? 10 : 8
        let font = CTFontCreateCopyWithAttributes(letterFont, cell + 1, nil, nil)
        var glyphs = [CGGlyph](repeating: 0, count: chars.count)
        CTFontGetGlyphsForCharacters(font, chars, &glyphs, chars.count)
        var advances = [CGSize](repeating: .zero, count: glyphs.count)
        CTFontGetAdvancesForGlyphs(font, .horizontal, glyphs, &advances, glyphs.count)
        let xh = CTFontGetXHeight(font)

        // Buckets of glyphs that share colour + glow, drawn in one call each.
        struct Bucket { var glyphs: [CGGlyph] = []; var points: [CGPoint] = [] }
        var buckets: [Int: Bucket] = [:]
        var n = 0
        var y: CGFloat = 0
        while y < h {
            var x: CGFloat = 0
            while x < w {
                let px = min(w - 1, x + cell / 2), py = min(h - 1, y + cell / 2)
                let v = alpha(mask, px, py)
                let gi = n % glyphs.count
                var level: Int
                if v < 0.05 {
                    if (Int(x) * 7 + Int(y) * 13) % 97 != 0 { x += cell; continue }
                    level = -1 // faint scattered letters in the dark
                } else {
                    level = min(10, Int(v * 10))
                }
                n += 1
                let cx = x + cell / 2, cy = y + cell / 2
                buckets[level, default: Bucket()].glyphs.append(glyphs[gi])
                buckets[level]!.points.append(CGPoint(x: cx - advances[gi].width / 2, y: cy + xh / 2))
                x += cell
            }
            y += cell
        }
        g.saveGState()
        g.textMatrix = CGAffineTransform(scaleX: 1, y: -1)
        for (level, b) in buckets {
            if level < 0 {
                g.setShadow(offset: .zero, blur: 0, color: nil)
                g.setFillColor(hsla(hue, 60, 70, 0.18))
            } else {
                let v = Double(level) / 10 + 0.05
                if v > 0.72 { g.setShadow(offset: .zero, blur: 7, color: hsla(hue, 100, 62, 0.95)) } else { g.setShadow(offset: .zero, blur: 0, color: nil) }
                g.setFillColor(hsla(hue + (v > 0.85 ? 14 : 0), v > 0.85 ? 100 : 85, 42 + v * 46, 0.22 + v * 0.78))
            }
            CTFontDrawGlyphs(font, b.glyphs, b.points, b.glyphs.count, g)
        }
        g.restoreGState()
    }

    // MARK: - scene geometry (port of the prototype's drawScene)

    private static func drawScene(_ g: CGContext, scene k: ArtScene, w: CGFloat, h: CGFloat, seed: String) {
        var R = SeededRandom(k.rawValue + "|" + seed)
        let wide = k == .sun || k == .mountain
        let tall = h > w * 1.35
        let S0 = min(w, h * 1.1)
        let zoom = tall ? 0.66 + R.next() * 0.2 : 0.78 + R.next() * 0.22
        let cx = w / 2 + (wide ? 0 : (R.next() - 0.5) * w * 0.26)
        let cy = h * (wide ? (tall ? 0.3 : 0.36) : (tall ? 0.2 + R.next() * 0.08 : 0.25 + R.next() * 0.1))
        let rot = wide ? 0 : (R.next() - 0.5) * 0.24
        let flip = R.next() < 0.5
        g.saveGState()
        g.translateBy(x: cx, y: cy)
        g.rotate(by: rot)
        if flip { g.scaleBy(x: -1, y: 1) }
        g.translateBy(x: -cx, y: -cy)
        drawSubject(g, k, S: S0 * zoom, cx: cx, cy: cy)
        g.restoreGState()

        g.setFillColor(UIColor.white.cgColor)
        let sr = S0 * zoom * 0.42
        let stars = 2 + Int(R.next() * 6)
        var placed = 0, tries = 0
        while placed < stars && tries < 40 {
            tries += 1
            let x = w * (0.06 + R.next() * 0.88), y = h * (0.05 + R.next() * 0.45)
            if hypot(x - cx, y - cy) < sr { continue }
            g.setShadow(offset: .zero, blur: S0 * 0.03, color: UIColor.white.cgColor)
            let r = S0 * (0.006 + R.next() * 0.01)
            g.fillEllipse(in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
            placed += 1
        }
        let comp = R.next()
        let side: CGFloat = cx > w / 2 ? -1 : 1
        g.setShadow(offset: .zero, blur: S0 * 0.04, color: UIColor.white.cgColor)
        if comp < 0.3 {
            // Hills
            g.setAlpha(0.5)
            let base = h * (0.84 + R.next() * 0.06), amp = h * (0.03 + R.next() * 0.04), ph = R.next() * 6
            g.move(to: CGPoint(x: 0, y: h))
            var x: CGFloat = 0
            while x <= w { g.addLine(to: CGPoint(x: x, y: base - sin(x / w * .pi * 1.6 + ph) * amp)); x += 6 }
            g.addLine(to: CGPoint(x: w, y: h)); g.closePath(); g.fillPath()
            g.setAlpha(1)
        } else if comp < 0.5 && k != .moon && k != .sun && k != .mountain {
            // Small crescent
            let mx = w / 2 + side * w * (0.28 + R.next() * 0.1), my = h * (0.1 + R.next() * 0.08), mr = S0 * (0.05 + R.next() * 0.03)
            g.fillEllipse(in: CGRect(x: mx - mr, y: my - mr, width: mr * 2, height: mr * 2))
            g.saveGState(); g.setBlendMode(.clear); g.setShadow(offset: .zero, blur: 0, color: nil)
            let ox = mx + mr * 0.45 * side, oy = my - mr * 0.3, orr = mr * 0.9
            g.fillEllipse(in: CGRect(x: ox - orr, y: oy - orr, width: orr * 2, height: orr * 2))
            g.restoreGState()
        } else if comp < 0.66 && !wide {
            // Cypress
            g.setAlpha(0.6)
            let tx = w / 2 + side * w * (0.32 + R.next() * 0.08), th = h * (0.26 + R.next() * 0.12), tw = th * 0.2, ty = h * 0.93
            g.move(to: CGPoint(x: tx, y: ty - th))
            g.addCurve(to: CGPoint(x: tx, y: ty), control1: CGPoint(x: tx + tw, y: ty - th * 0.6), control2: CGPoint(x: tx + tw * 0.9, y: ty - th * 0.15))
            g.addCurve(to: CGPoint(x: tx, y: ty - th), control1: CGPoint(x: tx - tw * 0.9, y: ty - th * 0.15), control2: CGPoint(x: tx - tw, y: ty - th * 0.6))
            g.fillPath()
            g.fill(CGRect(x: tx - tw * 0.08, y: ty - 2, width: tw * 0.16, height: h - ty + 2))
            g.setAlpha(1)
        }
        g.setShadow(offset: .zero, blur: 0, color: nil)
    }

    private static func drawSubject(_ g: CGContext, _ k: ArtScene, S: CGFloat, cx: CGFloat, cy: CGFloat) {
        g.setFillColor(UIColor.white.cgColor)
        g.setStrokeColor(UIColor.white.cgColor)
        g.setLineCap(.round); g.setLineJoin(.round)
        g.setShadow(offset: .zero, blur: S * 0.05, color: UIColor.white.cgColor)
        func P(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: cx + (x - 0.5) * S, y: cy + (y - 0.5) * S) }
        func circ(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat) { let p = P(x, y); g.fillEllipse(in: CGRect(x: p.x - r * S, y: p.y - r * S, width: r * S * 2, height: r * S * 2)) }
        func poly(_ pts: [(CGFloat, CGFloat)]) { g.beginPath(); for (i, p) in pts.enumerated() { i == 0 ? g.move(to: P(p.0, p.1)) : g.addLine(to: P(p.0, p.1)) }; g.closePath(); g.fillPath() }
        func line(_ pts: [(CGFloat, CGFloat)], _ lw: CGFloat) { g.setLineWidth(lw * S); g.beginPath(); for (i, p) in pts.enumerated() { i == 0 ? g.move(to: P(p.0, p.1)) : g.addLine(to: P(p.0, p.1)) }; g.strokePath() }
        func arc(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ a0: CGFloat, _ a1: CGFloat) { g.beginPath(); g.addArc(center: P(x, y), radius: r * S, startAngle: a0, endAngle: a1, clockwise: false); g.strokePath() }
        func cut(_ f: () -> Void) { g.saveGState(); g.setBlendMode(.clear); g.setShadow(offset: .zero, blur: 0, color: nil); f(); g.restoreGState() }

        switch k {
        case .moon:
            circ(0.5, 0.5, 0.3); cut { circ(0.63, 0.41, 0.27) }
            for s in [(0.16, 0.22, 0.016), (0.84, 0.72, 0.012), (0.26, 0.8, 0.01), (0.8, 0.18, 0.02), (0.9, 0.45, 0.01)] { circ(s.0, s.1, s.2) }
        case .cup:
            poly([(0.24, 0.22), (0.76, 0.22), (0.66, 0.54), (0.34, 0.54)]); line([(0.5, 0.54), (0.5, 0.78)], 0.05)
            poly([(0.34, 0.82), (0.66, 0.82), (0.6, 0.77), (0.4, 0.77)]); circ(0.5, 0.14, 0.02)
        case .jug:
            circ(0.5, 0.6, 0.25); poly([(0.42, 0.14), (0.58, 0.14), (0.61, 0.42), (0.39, 0.42)])
            g.setLineWidth(0.05 * S); g.beginPath(); g.addArc(center: P(0.72, 0.44), radius: 0.12 * S, startAngle: -.pi / 2, endAngle: .pi / 2, clockwise: false); g.strokePath()
        case .candle:
            poly([(0.42, 0.46), (0.58, 0.46), (0.58, 0.9), (0.42, 0.9)])
            g.beginPath(); g.move(to: P(0.5, 0.1))
            g.addCurve(to: P(0.5, 0.42), control1: P(0.66, 0.28), control2: P(0.6, 0.42))
            g.addCurve(to: P(0.5, 0.1), control1: P(0.4, 0.42), control2: P(0.34, 0.28))
            g.setShadow(offset: .zero, blur: S * 0.16, color: UIColor.white.cgColor); g.fillPath()
            g.setShadow(offset: .zero, blur: S * 0.05, color: UIColor.white.cgColor)
        case .ney:
            line([(0.16, 0.86), (0.84, 0.14)], 0.09)
            cut { for p in [(0.36, 0.65), (0.44, 0.56), (0.52, 0.48), (0.6, 0.39)] { circ(p.0, p.1, 0.02) } }
            g.setLineWidth(0.016 * S)
            for r in [0.12, 0.2, 0.28] { arc(0.84, 0.14, r, .pi * 0.15, .pi * 0.6) }
        case .sun:
            g.beginPath(); g.addArc(center: P(0.5, 0.62), radius: 0.24 * S, startAngle: .pi, endAngle: 0, clockwise: false); g.fillPath()
            line([(0.06, 0.63), (0.94, 0.63)], 0.012)
            for i in 0..<9 {
                let t = CGFloat.pi + CGFloat(i) * .pi / 8
                line([(0.5 + cos(t) * 0.32, 0.62 + sin(t) * 0.32), (0.5 + cos(t) * 0.45, 0.62 + sin(t) * 0.45)], 0.024)
            }
            line([(0.2, 0.74), (0.8, 0.74)], 0.01); line([(0.32, 0.83), (0.68, 0.83)], 0.01)
        case .ring:
            circ(0.5, 0.5, 0.1)
            for i in 0..<6 {
                let t = CGFloat(i) * .pi / 3 - .pi / 2
                circ(0.5 + cos(t) * 0.31, 0.5 + sin(t) * 0.31, 0.075)
                line([(0.5 + cos(t) * 0.12, 0.5 + sin(t) * 0.12), (0.5 + cos(t) * 0.23, 0.5 + sin(t) * 0.23)], 0.022)
            }
        case .cups:
            poly([(0.1, 0.3), (0.42, 0.3), (0.37, 0.53), (0.15, 0.53)]); line([(0.26, 0.53), (0.26, 0.74)], 0.035)
            poly([(0.58, 0.3), (0.9, 0.3), (0.85, 0.53), (0.63, 0.53)]); line([(0.74, 0.53), (0.74, 0.74)], 0.035)
            line([(0.16, 0.78), (0.36, 0.78)], 0.03); line([(0.64, 0.78), (0.84, 0.78)], 0.03)
            circ(0.5, 0.2, 0.025); circ(0.44, 0.14, 0.015); circ(0.57, 0.12, 0.015)
        case .mountain:
            poly([(0.02, 0.86), (0.38, 0.28), (0.58, 0.6), (0.72, 0.44), (0.98, 0.86)]); circ(0.8, 0.18, 0.07)
            cut { poly([(0.38, 0.28), (0.46, 0.41), (0.4, 0.38), (0.33, 0.42), (0.31, 0.39)]) }
        case .feather:
            g.beginPath(); g.move(to: P(0.24, 0.9))
            g.addCurve(to: P(0.82, 0.08), control1: P(0.18, 0.45), control2: P(0.55, 0.14))
            g.addCurve(to: P(0.24, 0.9), control1: P(0.76, 0.45), control2: P(0.5, 0.76))
            g.fillPath()
            cut { line([(0.26, 0.88), (0.74, 0.16)], 0.012) }
        case .rose:
            circ(0.5, 0.32, 0.17)
            cut { g.setLineWidth(0.012 * S); for r in [0.05, 0.1, 0.14] { arc(0.5, 0.33, r, 0.3, 5.5) } }
            line([(0.5, 0.48), (0.5, 0.92)], 0.025)
            g.saveGState(); let p = P(0.41, 0.7); g.translateBy(x: p.x, y: p.y); g.rotate(by: -0.6)
            g.fillEllipse(in: CGRect(x: -0.09 * S, y: -0.032 * S, width: 0.18 * S, height: 0.064 * S)); g.restoreGState()
        }
    }
}
