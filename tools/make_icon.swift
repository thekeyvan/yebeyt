// Renders the 1024×1024 placeholder app icon: the two-sticker mark of the StickerSystem board on paper.
// Usage: swift tools/make_icon.swift <out.png>
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let S: CGFloat = 1024
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: Int(S), height: Int(S), bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.translateBy(x: 0, y: S); ctx.scaleBy(x: 1, y: -1)  // y down, like the board
func hex(_ v: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(colorSpace: cs, components: [CGFloat((v >> 16) & 0xFF) / 255, CGFloat((v >> 8) & 0xFF) / 255, CGFloat(v & 0xFF) / 255, a])!
}
func roundedRect(_ rect: CGRect, _ radius: CGFloat) -> CGPath {
    CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

ctx.setFillColor(hex(0xF1EFEA))
ctx.fill(CGRect(x: 0, y: 0, width: S, height: S))

// The board's mark is 150×120 css px: two 76×96 stickers, radius 22, 6px white border, a 40×9 white bar.
let k: CGFloat = 5.2
func sticker(center: CGPoint, color: UInt32, degrees: CGFloat) {
    let w = 76 * k, h = 96 * k, border = 6 * k, radius = 22 * k
    ctx.saveGState()
    ctx.translateBy(x: center.x, y: center.y)
    ctx.rotate(by: degrees * .pi / 180)  // positive = clockwise on screen, like CSS
    let outer = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -4 * k), blur: 12 * k, color: hex(0x14112B, 0.25))  // y is flipped: negative = down
    ctx.addPath(roundedRect(outer, radius)); ctx.setFillColor(hex(0xFFFFFF)); ctx.fillPath()
    ctx.restoreGState()
    ctx.addPath(roundedRect(outer.insetBy(dx: border, dy: border), radius - border)); ctx.setFillColor(hex(color)); ctx.fillPath()
    ctx.addPath(roundedRect(CGRect(x: -20 * k, y: -4.5 * k, width: 40 * k, height: 9 * k), 5 * k)); ctx.setFillColor(hex(0xFFFFFF)); ctx.fillPath()
    ctx.restoreGState()
}
sticker(center: CGPoint(x: S / 2 + 37 * k, y: S / 2 - 8 * k), color: 0x2F35F5, degrees: -7)  // lapis, right
sticker(center: CGPoint(x: S / 2 - 37 * k, y: S / 2 + 4 * k), color: 0xFF4D24, degrees: 6)   // fire, left, on top

let out = URL(fileURLWithPath: CommandLine.arguments[1])
let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
print("wrote", out.path)
