// Renders the 1024×1024 app icon: a glowing turquoise crescent with a few stars on near-black.
// Usage: swift tools/make_icon.swift <out.png>
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let S: CGFloat = 1024
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: Int(S), height: Int(S), bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.translateBy(x: 0, y: S); ctx.scaleBy(x: 1, y: -1)
func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor { CGColor(colorSpace: cs, components: [r / 255, g / 255, b / 255, a])! }

ctx.setFillColor(rgb(12, 12, 15)); ctx.fill(CGRect(x: 0, y: 0, width: S, height: S))
for (x, y, c, r) in [(0.25, 0.22, rgb(46, 150, 214, 0.55), 0.7), (0.85, 0.2, rgb(60, 90, 220, 0.4), 0.6), (0.7, 0.8, rgb(30, 196, 180, 0.35), 0.7)] as [(CGFloat, CGFloat, CGColor, CGFloat)] {
    let g = CGGradient(colorsSpace: cs, colors: [c, rgb(0, 0, 0, 0)] as CFArray, locations: [0, 1])!
    ctx.drawRadialGradient(g, startCenter: CGPoint(x: x * S, y: y * S), startRadius: 0, endCenter: CGPoint(x: x * S, y: y * S), endRadius: r * S, options: [])
}

// Crescent mask
let mask = CGContext(data: nil, width: Int(S), height: Int(S), bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
mask.translateBy(x: 0, y: S); mask.scaleBy(x: 1, y: -1)
mask.setFillColor(rgb(255, 255, 255))
let c = CGPoint(x: S * 0.5, y: S * 0.5), R = S * 0.3
mask.fillEllipse(in: CGRect(x: c.x - R, y: c.y - R, width: R * 2, height: R * 2))
mask.setBlendMode(.clear)
let R2 = R * 0.88, c2 = CGPoint(x: c.x + R * 0.42, y: c.y - R * 0.28)
mask.fillEllipse(in: CGRect(x: c2.x - R2, y: c2.y - R2, width: R2 * 2, height: R2 * 2))
mask.setBlendMode(.normal)
for (x, y, r) in [(0.74, 0.3, 0.018), (0.8, 0.46, 0.011), (0.66, 0.2, 0.009), (0.3, 0.78, 0.008)] as [(CGFloat, CGFloat, CGFloat)] {
    mask.fillEllipse(in: CGRect(x: x * S - r * S, y: y * S - r * S, width: r * S * 2, height: r * S * 2))
}
// Tint the mask with a turquoise gradient
mask.setBlendMode(.sourceIn)
let tg = CGGradient(colorsSpace: cs, colors: [rgb(170, 245, 255), rgb(46, 196, 214), rgb(20, 110, 160)] as CFArray, locations: [0, 0.6, 1])!
mask.drawLinearGradient(tg, start: CGPoint(x: 0, y: S * 0.2), end: CGPoint(x: 0, y: S * 0.8), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
let tinted = mask.makeImage()!

ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 90, color: rgb(46, 196, 214, 0.9))
ctx.draw(tinted, in: CGRect(x: 0, y: 0, width: S, height: S))
ctx.restoreGState()
ctx.draw(tinted, in: CGRect(x: 0, y: 0, width: S, height: S))

let out = URL(fileURLWithPath: CommandLine.arguments[1])
let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
print("wrote", out.path)
