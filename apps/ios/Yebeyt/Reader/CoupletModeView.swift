import SwiftUI

/// One couplet at a time. Pages scroll vertically and snap, each with the nearest hemistich of the
/// couplets before and after faintly above and below.
struct CoupletModeView: View {
    @Bindable var model: ReaderModel

    var body: some View {
        ScrollView(.vertical) {
            LazyVStack(spacing: 0) {
                ForEach(model.couplets.indices, id: \.self) { page in
                    CoupletPage(model: model, index: page)
                        .containerRelativeFrame(.vertical)
                        .id(page)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollDisabled(model.meaningOpen || model.holdIndex != nil || model.textSheetOpen)
        .scrollPosition(id: Binding<Int?>(get: { model.index }, set: { new in if let new { model.go(to: new) } }), anchor: .top)
    }
}

private struct CoupletPage: View {
    @Environment(TextSettingsStore.self) private var text
    let model: ReaderModel
    let index: Int

    var body: some View {
        let settings = text.settings
        let couplet = model.couplets[index]
        let showsMeaning = model.meaningOpen && index == model.index && !model.textSheetOpen
        if model.textSheetOpen {
            // With the «آ» sheet open only the couplet shows, at the top, where the sheet doesn't cover it.
            CoupletText(couplet: couplet, settings: settings, size: CGFloat(settings.size), factor: settings.spacing.factor, color: settings.theme.foreground)
                .padding(.horizontal, 30)
                .frame(maxHeight: .infinity, alignment: .top)
        } else {
            pageContent(couplet, settings: settings, showsMeaning: showsMeaning)
        }
    }

    private func pageContent(_ couplet: Couplet, settings: TextSettings, showsMeaning: Bool) -> some View {
        ViewThatFits(in: .vertical) {
            column(couplet, settings: settings, showsMeaning: showsMeaning)
            ScrollView { column(couplet, settings: settings, showsMeaning: showsMeaning).padding(.vertical, 20) }
                .scrollBounceBehavior(.basedOnSize)
        }
        .padding(.horizontal, 40)
        // The meaning board centres its content 22pt higher than the couplet board does.
        .padding(.bottom, showsMeaning ? 84 : 40)
    }

    private func column(_ couplet: Couplet, settings: TextSettings, showsMeaning: Bool) -> some View {
        VStack(spacing: showsMeaning ? 22 : 34) {
            if !showsMeaning { faint(CoupletPaging.above(index, in: model.couplets), settings) }
            VStack(spacing: 22) {
                CoupletText(couplet: couplet, settings: settings, size: CGFloat(settings.size), factor: settings.spacing.factor, color: settings.theme.foreground)
                    .accessibilityIdentifier("couplet-\(index)")
                    .contentShape(Rectangle())
                    .onLongPressGesture(minimumDuration: 0.5) { model.holdIndex = index }
                if showsMeaning, let meaning = couplet.meaning {
                    MeaningCard(text: meaning, expanded: Binding(get: { model.meaningExpanded }, set: { model.meaningExpanded = $0 }), close: { withAnimation(.snappy) { model.closeMeaning() } })
                }
                ReaderActionRow(model: model, couplet: index)
                if !showsMeaning, couplet.meaning != nil { meaningChip }
            }
            if !showsMeaning { faint(CoupletPaging.below(index, in: model.couplets), settings) }
        }
        .frame(maxWidth: .infinity)
    }

    /// The nearest hemistich of the next or previous couplet. The space stays when there is none, so the couplet doesn't jump.
    private func faint(_ line: String?, _ settings: TextSettings) -> some View {
        Text(line ?? "")
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .poemLine(settings, size: 15, factor: 1.8)
            .foregroundStyle(settings.theme.foreground.opacity(0.25))
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }

    private var meaningChip: some View {
        Button {
            withAnimation(.snappy) { model.openMeaning() }
        } label: {
            HStack(spacing: 6) {
                LineIcon(shape: BookIcon(), size: 16, lineWidth: 2.2, fill: nil)
                Text("معنی این بیت").font(.ui(14, weight: .bold))
            }
            .foregroundStyle(Tokens.Colors.lapis)
            .padding(.horizontal, 16)
            .padding(.vertical, 7)
            .background(Capsule().fill(ReaderStyle.lapisTint))
        }
        .buttonStyle(.plain)
    }
}
