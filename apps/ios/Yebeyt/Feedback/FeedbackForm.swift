import SwiftUI

/// FeedbackBug, and its three text-only relatives (یه جاش اذیتم کرد, یه ایده دارم, خوشم اومد): the same layout without the
/// parts the type does not take.
struct FeedbackForm: View {
    let center: FeedbackCenter
    @Bindable var model: FeedbackModel
    @State private var editing = false

    private var type: FeedbackType { model.type }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                FeedbackHeader(title: type.title, canSend: model.canSend, close: { Task { await center.close() } }, send: { Task { await center.send() } })
                VStack(alignment: .leading, spacing: 6) {
                    if type == .bug { FeedbackLabel(title: "چی شد؟") }
                    FeedbackTextArea(
                        text: $model.draft.text, minHeight: type == .bug ? 74 : 118, placeholder: type == .bug ? "" : "بنویس…",
                        id: "feedbackText", disabled: model.isLocked
                    )
                }
                if type == .bug {
                    frequency
                    recording
                }
                if let failure = model.failure { FeedbackFailureLine(line: failure) }
                if type.takesScreenshot, model.image != nil { attachment }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .background(Tokens.Colors.boardPaper.ignoresSafeArea())
        .fullScreenCover(isPresented: $editing) {
            if let image = model.image {
                ScreenshotEditor(image: image) { edited in
                    if let edited { model.edited = edited }
                    editing = false
                }
                .environment(\.layoutDirection, .rightToLeft)
            }
        }
    }

    // MARK: Bug only

    private var frequency: some View {
        HStack(spacing: 10) {
            Text("چند بار پیش اومده؟").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink).fixedSize()
            SegmentedControl(
                options: FeedbackFrequency.allCases.map { ($0, $0.title) }, selection: $model.draft.frequency,
                style: .feedback(vertical: 7), label: "چند بار پیش اومده؟", idPrefix: "feedbackFrequency"
            )
            .disabled(model.isLocked)
        }
    }

    @ViewBuilder private var recording: some View {
        if let clip = model.recording {
            HStack(spacing: 8) {
                RecordGlyph(size: 16).foregroundStyle(Tokens.Colors.fire)
                Text("فیلم ضبط شد · \(PersianDigits.clock(clip.seconds))").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityIdentifier("feedbackRecorded")
                Spacer(minLength: 0)
                Button { model.removeRecording() } label: {
                    LineIcon(shape: CloseIcon(), size: 14, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.muted)
                        .frame(width: 30, height: 30)
                        .background(Circle().fill(Tokens.Colors.paper))
                }
                .buttonStyle(.plain)
                .disabled(model.isLocked)
                .accessibilityLabel("حذف فیلم")
                .accessibilityIdentifier("feedbackRemoveRecording")
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.white))
        } else if center.recordingAvailable {
            Button { Task { await center.startRecording() } } label: {
                HStack(spacing: 8) {
                    RecordGlyph(size: 16)
                    Text("دوباره انجامش بده، ما فیلم می‌گیریم").font(.ui(13, weight: .bold))
                }
                .foregroundStyle(Tokens.Colors.fire)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.white))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Tokens.Colors.fire.opacity(0.35), style: StrokeStyle(lineWidth: 2, dash: [5, 4])))
            }
            .buttonStyle(.plain)
            .disabled(model.isLocked)
            .accessibilityIdentifier("feedbackRecord")
        }
    }

    // MARK: The card with the screenshot

    private var attachment: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("از همون لحظه همراهش می‌فرستیم").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
            HStack(spacing: 12) {
                thumbnail
                VStack(alignment: .leading, spacing: 4) {
                    Text("عکس صفحه").font(.ui(13, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                    Button { editing = true } label: {
                        HStack(spacing: 4) {
                            LineIcon(shape: WriteIcon(), size: 14, lineWidth: 2.4, fill: nil)
                            Text("خط بکش یا بپوشون").font(.ui(11.5, weight: .bold))
                        }
                        .foregroundStyle(Tokens.Colors.lapis)
                    }
                    .buttonStyle(.plain)
                    .disabled(!model.draft.screenshotOn || model.isLocked)
                    .accessibilityIdentifier("feedbackEdit")
                }
                Spacer(minLength: 0)
                Toggle("عکس صفحه", isOn: $model.draft.screenshotOn)
                    .toggleStyle(FeedbackSwitchStyle())
                    .labelsHidden()
                    .disabled(model.isLocked)
                    .accessibilityLabel("عکس صفحه")
                    .accessibilityIdentifier("feedbackScreenshotSwitch")
            }
            if type.sendsTechnical { technical }
            Text("چیزی که جای دیگه تایپ کردی یا پیام‌هات هیچ‌وقت همراهش نمیاد. عکس صفحه رو خودت تصمیم می‌گیری.")
                .font(.ui(11)).foregroundStyle(Color.feedbackHint).lineSpacing(3)
        }
        .padding(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
        .frame(maxWidth: .infinity, alignment: .leading)
        .meCard(radius: 22, shadow: 0.06)
    }

    @ViewBuilder private var thumbnail: some View {
        if let image = model.image {
            let width: CGFloat = 40
            Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
                .frame(width: width, height: width * 2.17)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Tokens.Colors.white, lineWidth: 4))
                .padding(0)
                .shadow(color: Tokens.Colors.ink.opacity(0.22), radius: 8, x: 0, y: 6)
                .opacity(model.draft.screenshotOn ? 1 : 0.4)
                .accessibilityLabel("عکس صفحه")
                .accessibilityIdentifier("feedbackThumbnail")
        }
    }

    // MARK: Technical info

    private var technical: some View {
        VStack(alignment: .leading, spacing: 8) {
            Rectangle().fill(.clear).frame(height: 1)
                .overlay(Rectangle().stroke(Color(hex: 0xE6E1D6), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            Button { withAnimation(.snappy) { model.technicalOpen.toggle() } } label: {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("اطلاعات فنی").font(.ui(13, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                        Text("همون لحظه، کارهای قبلش، خطاها، گوشی").font(.ui(11.5)).foregroundStyle(Color.feedbackHint)
                    }
                    Spacer(minLength: 0)
                    Text(model.technicalOpen ? "ببند" : "ببین چیه").font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                    LineIcon(shape: ChevronDownIcon(), size: 14, lineWidth: 2.6, fill: nil).foregroundStyle(Color.feedbackHint)
                        .rotationEffect(.degrees(model.technicalOpen ? 180 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("feedbackTechnicalToggle")
            if model.technicalOpen {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(model.snapshot.info.rows.enumerated()), id: \.offset) { _, row in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(row.label).font(.ui(12)).foregroundStyle(Color.feedbackHint).frame(width: 96, alignment: .leading)
                            Text(row.value).font(.ui(12, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                                .environment(\.layoutDirection, row.label == "بیت" ? .leftToRight : .rightToLeft)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .accessibilityIdentifier("feedbackTechnicalRows")
            }
        }
    }
}
