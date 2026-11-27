import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { feedbackPrivate } from "../lib/feedbackPrivate";
import { TextBubble } from "../components/messages/Bubbles";
import { InboxRow } from "../components/messages/InboxRow";
import { row } from "./messages";

// The feedback screenshot (W9) blanks what carries `data-feedback-private`: message text and what is typed (the privacy rule of docs/yebeyt-2.md). The end-to-end test checks every messages screen.

const marked = (node: Element) => node.closest("[data-feedback-private]") !== null;

describe("views of message text are marked private to the feedback screenshot", () => {
  it("the attribute is the one W9 looks for", () => {
    expect(feedbackPrivate).toEqual({ "data-feedback-private": "" });
  });

  it("a bubble, mine or theirs, is marked, and so is the one that says a message was deleted", () => {
    render(
      <>
        <TextBubble text="سلام" mine />
        <TextBubble text="جواب" mine={false} />
        <TextBubble text="این پیام پاک شد" mine={false} muted />
      </>,
    );
    for (const text of ["سلام", "جواب", "این پیام پاک شد"]) expect(marked(screen.getByText(text)), text).toBe(true);
  });

  it("the preview line of an inbox row is marked, and the name is not", () => {
    render(<InboxRow row={row("c1", "sara", "سارا", "یه مشاعره شروع کرد", { unread: 1 })} last open={() => {}} active={false} now={new Date("2026-11-24T12:00:00Z")} />);
    expect(marked(screen.getByText("یه مشاعره شروع کرد"))).toBe(true);
    expect(marked(screen.getByText("سارا"))).toBe(false);
  });
});
