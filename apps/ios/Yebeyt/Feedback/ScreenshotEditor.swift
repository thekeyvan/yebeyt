import SwiftUI

/// «خط بکش یا بپوشون»: a full screen to draw ink lines or cover parts of the screenshot with solid ink before it is
/// sent. «تمام» hands back the picture with the marks; × keeps the picture as it was.
struct ScreenshotEditor: View {
    enum Tool { case line, cover }

    let image: UIImage
    let done: (UIImage?) -> Void
    @State private var markup = ScreenshotMarkup()
    @State private var tool = Tool.line
    @State private var live: ScreenshotMarkup.Mark?
    @State private var dragStart: CGPoint?

    var body: some View {
        VStack(spacing: 14) {
            header
            Image(uiImage: image).resizable().scaledToFit()
                .overlay { drawing }
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 8, x: 0, y: 4)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityIdentifier("editorPicture")
            tools
        }
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .padding(.bottom, 16)
        .background(Tokens.Colors.boardPaper.ignoresSafeArea())
        .font(.ui(16))
        .preferredColorScheme(.light)
    }

    private var header: some View {
        HStack(spacing: 10) {
            Button { done(nil) } label: {
                LineIcon(shape: CloseIcon(), size: 18, lineWidth: 2.6, fill: nil)
                    .foregroundStyle(Tokens.Colors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.1), radius: 4, x: 0, y: 2))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("بستن")
            .accessibilityIdentifier("editorClose")
            Text("خط بکش یا بپوشون").font(.title(22)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            Button { done(markup.isEmpty ? nil : markup.render(on: image)) } label: {
                Text("تمام").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                    .padding(.horizontal, 16).padding(.vertical, 7)
                    .background(Capsule().fill(Tokens.Colors.lapis))
                    .overlay(Capsule().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .shadow(color: Tokens.Colors.lapis.opacity(0.28), radius: 5, x: 0, y: 3)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("editorDone")
        }
    }

    private var tools: some View {
        HStack(spacing: 10) {
            SegmentedControl(
                options: [(Tool.line, "خط بکش"), (Tool.cover, "بپوشون")], selection: $tool,
                style: .feedback(vertical: 8), label: "ابزار", idPrefix: "editorTool"
            )
            Button { markup.undo() } label: {
                Text("برگردون").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .background(Capsule().fill(Tokens.Colors.white))
                    .opacity(markup.isEmpty ? 0.4 : 1)
            }
            .buttonStyle(.plain)
            .disabled(markup.isEmpty)
            .accessibilityIdentifier("editorUndo")
        }
    }

    /// The marks over the picture, drawn in the picture's own box so they match what `render` draws.
    private var drawing: some View {
        GeometryReader { box in
            Canvas { context, size in
                for mark in markup.marks + (live.map { [$0] } ?? []) { Self.draw(mark, in: &context, size: size) }
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                let point = Self.fraction(value.location, in: box.size)
                switch tool {
                case .line:
                    if case .line(let points) = live { live = .line(points + [point]) } else { live = .line([point]) }
                case .cover:
                    let start = dragStart ?? point
                    dragStart = start
                    live = .cover(CGRect(x: min(start.x, point.x), y: min(start.y, point.y), width: abs(point.x - start.x), height: abs(point.y - start.y)))
                }
            }.onEnded { _ in
                if let live { markup.add(live) }
                live = nil
                dragStart = nil
            })
        }
    }

    private static func fraction(_ point: CGPoint, in size: CGSize) -> CGPoint {
        CGPoint(x: min(max(point.x / max(size.width, 1), 0), 1), y: min(max(point.y / max(size.height, 1), 0), 1))
    }

    private static func draw(_ mark: ScreenshotMarkup.Mark, in context: inout GraphicsContext, size: CGSize) {
        let width = ScreenshotMarkup.lineWidth * max(size.width, size.height)
        switch mark {
        case .line(let points):
            var path = Path()
            guard let first = points.first else { return }
            path.move(to: CGPoint(x: first.x * size.width, y: first.y * size.height))
            if points.count == 1 {
                path.addLine(to: CGPoint(x: first.x * size.width + 0.01, y: first.y * size.height))
            }
            points.dropFirst().forEach { path.addLine(to: CGPoint(x: $0.x * size.width, y: $0.y * size.height)) }
            context.stroke(path, with: .color(Tokens.Colors.ink), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
        case .cover(let rect):
            context.fill(
                Path(CGRect(x: rect.minX * size.width, y: rect.minY * size.height, width: rect.width * size.width, height: rect.height * size.height)),
                with: .color(Tokens.Colors.ink)
            )
        }
    }
}
