import SwiftUI
import Observation

enum Tab: String, CaseIterable {
    case home, library, me
    var title: String {
        switch self {
        case .home: "خانه"
        case .library: "کتابخانه"
        case .me: "من"
        }
    }
    var icon: String {
        switch self {
        case .home: "house"
        case .library: "books.vertical"
        case .me: "person"
        }
    }
}

/// Full screens pushed on top of the tabs.
enum Route: Hashable {
    case poem(url: String, focus: Int?, play: Bool, layout: String?)
    case mood(String)
    case search
    case fal
    case book(String)
    case saved
}

/// Bottom sheets.
enum SheetRoute: Identifiable, Hashable {
    case poet(String)
    case couplet(String, Int)
    /// `clear`: start with the clean (eye-on) picture.
    case share(String, Int, clear: Bool = false)
    case font
    case more(String)
    case summary(String)
    case songs(String)
    case details(String)
    case reciters(String)
    case about
    var id: String { String(describing: self) }
}

@Observable
final class Router {
    var tab: Tab = .home
    var path: [Route] = []
    var sheet: SheetRoute?
    /// Full-screen Now Playing.
    var nowPlaying = false
    var toast: String?
    private var toastTask: Task<Void, Never>?

    func open(_ r: Route) {
        sheet = nil
        path.append(r)
    }
    func openPoem(_ url: String, focus: Int? = nil, play: Bool = false, layout: String? = nil) {
        open(.poem(url: url, focus: focus, play: play, layout: layout))
    }
    func show(_ s: SheetRoute) {
        if sheet != nil {
            sheet = nil
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(350))
                self.sheet = s
            }
        } else {
            sheet = s
        }
    }
    func say(_ msg: String) {
        toastTask?.cancel()
        withAnimation(.spring(duration: 0.3)) { toast = msg }
        toastTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(2.2))
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.3)) { self.toast = nil }
        }
    }
    func go(_ t: Tab) {
        path.removeAll()
        tab = t
    }
}
