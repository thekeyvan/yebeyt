import SwiftUI

/// Shows a scene for a couplet. Rendered once per size and cached.
/// - `painted`: the clean coloured scene (small tiles, the eye mode).
/// - `blur`: how soft the letters look (backdrops are heavy, the home deck is in between).
struct ArtView: View {
    let scene: ArtScene
    let seed: String
    var text: String = ""
    var painted = false
    var blur: CGFloat = 0

    @State private var image: UIImage?

    var body: some View {
        GeometryReader { geo in
            let size = CGSize(width: geo.size.width.rounded(), height: geo.size.height.rounded())
            ZStack {
                Palette.cardBlack
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .blur(radius: blur, opaque: true)
                        .scaleEffect(blur > 4 ? 1.08 : 1)
                        .transition(.opacity)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
            .task(id: "\(scene.rawValue)|\(seed)|\(size.width)x\(size.height)|\(painted)") {
                guard size.width > 2, size.height > 2 else { return }
                if let c = SceneArt.cached(scene: scene, seed: seed, size: size, painted: painted) { image = c; return }
                let (sc, sd, tx, pt) = (scene, seed, text.isEmpty ? seed : text, painted)
                let img = await Task.detached(priority: .userInitiated) {
                    SceneArt.image(scene: sc, seed: sd, text: tx, size: size, painted: pt)
                }.value
                withAnimation(.easeOut(duration: 0.35)) { image = img }
            }
        }
    }
}

extension ArtView {
    /// Art for one couplet: the scene comes from its mood, poem or poet; the composition from its text.
    init(_ ref: CoupletRef, text: String, painted: Bool = false, blur: CGFloat = 0) {
        self.init(scene: Content.scene(for: ref.url, index: ref.index), seed: text, text: text, painted: painted, blur: blur)
    }
}
