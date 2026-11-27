import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsCenter } from "../lib/friends/center";
import { MessagesCenter } from "../lib/messages/center";
import { Store } from "../lib/reader/store";
import { fakeServer, ok, refuse } from "./friends";
import { FakeSockets, page, sara } from "./messages";

// What is typed in the inbox's search and in a chat's composer is still there when the session settles (loading, then signed in): the chat was drawn anew and the chats
// were forgotten while the session was still being asked about, which lost the text (and sent a message into a model nobody drew any more).

const held = vi.hoisted(() => ({ services: undefined as unknown }));

vi.mock("../components/account/useServices", () => ({ useServices: () => held.services }));
vi.mock("../components/account/AccountProvider", () => ({ useAccount: () => ({ require: (_feature: string, action: () => void) => action() }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/messages/sara", useRouter: () => ({ push: () => {}, back: () => {} }) }));
vi.mock("../components/messages/CoupletPickerSheet", () => ({ CoupletPickerSheet: () => null }));
vi.mock("../components/messages/NewChatSheet", () => ({ NewChatSheet: () => null }));

const { ChatScreen } = await import("../components/messages/ChatScreen");
const { InboxScreen } = await import("../components/messages/InboxScreen");
const { MessagesHost } = await import("../components/messages/MessagesHost");

type Status = "loading" | "guest" | "in";

class FakeSession extends Store<{ status: Status }> {
  readonly isSignedIn = false;
  readonly user = undefined;
  constructor() {
    super({ status: "loading" });
  }
  settle(status: Status): void {
    this.set({ status });
  }
}

function services() {
  const server = fakeServer((request) => {
    if (request.path === "/v1/conversations" && request.method === "POST") return ok({ id: "c1", other: sara });
    if (request.path === "/v1/conversations") return ok({ items: [], nextCursor: null });
    if (request.path.endsWith("/messages")) return ok(page([]));
    return refuse(404, "not_found");
  });
  const session = new FakeSession();
  const friends = new FriendsCenter({ user: undefined }, server.api);
  const messages = new MessagesCenter({ friends, api: server.api, sockets: new FakeSockets(), token: async () => ({ token: "t", url: "wss://x/v1/live" }) });
  const made = { session, api: server.api, friends, messages };
  held.services = made;
  return made;
}

beforeEach(() => {
  // jsdom has no IntersectionObserver or scrolling.
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords = () => [];
  } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollTo = () => {};
});

describe("typed text survives the session settling", () => {
  it("the composer of a chat keeps what was typed when the session goes from loading to signed in", async () => {
    const { session, messages } = services();
    // Opening a chat takes a moment, as a call to the server does: a screen that asks again for it is drawn empty meanwhile.
    const open = messages.openChat.bind(messages);
    messages.openChat = async (username) => (await new Promise((resolve) => setTimeout(resolve, 5)), open(username));
    render(<ChatScreen username="sara" />);
    const composer = await screen.findByTestId("composer");
    fireEvent.change(composer, { target: { value: "سلام سارا" } });
    expect(screen.getByTestId("composer")).toHaveValue("سلام سارا");
    await act(async () => {
      session.settle("in");
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByTestId("composer")).toBe(composer); // the same field, not a new one
    expect(screen.getByTestId("composer")).toHaveValue("سلام سارا");
  });

  it("the inbox's search keeps what was typed when the host of the live socket comes up while the session is still loading, and the chats are forgotten only for a known guest", async () => {
    const { session, messages } = services();
    render(<InboxScreen />);
    const search = await screen.findByRole("searchbox", { name: "جستجو بین دوستات" });
    fireEvent.change(search, { target: { value: "سار" } });
    expect(search).toHaveValue("سار");
    render(<MessagesHost services={held.services as never} />); // it comes up after the inbox did (the account's runtime is made apart)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByRole("searchbox", { name: "جستجو بین دوستات" })).toHaveValue("سار");
    await act(async () => {
      session.settle("in");
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByRole("searchbox", { name: "جستجو بین دوستات" })).toHaveValue("سار");
    await act(async () => session.settle("guest")); // signed out for sure: the chats go
    await waitFor(() => expect(messages.inbox.snapshot().query).toBe(""));
  });
});
