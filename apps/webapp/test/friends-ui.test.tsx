import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FriendControl } from "../components/friends/FriendControl";
import { PersonRow } from "../components/friends/PersonRow";
import { TabBar } from "../components/ui/TabBar";
import type { Friendship } from "../lib/friends/models";

describe("what a row shows for the friendship (FriendControl)", () => {
  const states: [Friendship, string[]][] = [["none", ["درخواست دوستی"]], ["requested", ["درخواست فرستادی"]], ["incoming", ["قبول", "رد"]], ["friends", []]];

  for (const [friendship, titles] of states) {
    it(`${friendship}: ${titles.join(" و ") || "the chip «دوستین»"}`, () => {
      render(<FriendControl username="sara" friendship={friendship} act={() => {}} />);
      expect(screen.queryAllByRole("button").map((button) => button.textContent)).toEqual(titles);
      expect(screen.queryByTestId("friends-sara")?.textContent ?? undefined).toBe(friendship === "friends" ? "دوستین" : undefined);
    });
  }

  it("tells which action was pressed, and a busy button cannot be pressed twice", () => {
    const act = vi.fn();
    const { rerender } = render(<FriendControl username="aryan" friendship="incoming" act={act} />);
    fireEvent.click(screen.getByTestId("reject-aryan"));
    fireEvent.click(screen.getByTestId("accept-aryan"));
    expect(act.mock.calls).toEqual([["reject"], ["accept"]]);
    rerender(<FriendControl username="aryan" friendship="incoming" busy act={act} />);
    expect(screen.getByTestId("accept-aryan")).toBeDisabled();
  });

  it("the main buttons are lapis and the quiet ones grey", () => {
    render(<FriendControl username="aryan" friendship="incoming" act={() => {}} />);
    expect(screen.getByTestId("accept-aryan").className).toContain("bg-lapis");
    expect(screen.getByTestId("reject-aryan").className).toContain("bg-track-light");
  });
});

describe("a person in a list (PersonRow)", () => {
  it("shows the name, the username and a link to their page; a friend in my list has the chip and no buttons", () => {
    render(<PersonRow person={{ username: "kian_k", displayName: "کیان", avatar: null, canPlay: true, friendship: "friends", isFriend: true }} />);
    expect(screen.getByTestId("person-kian_k")).toHaveAttribute("href", "/u/kian_k");
    expect(screen.getByText("کیان")).toBeInTheDocument();
    expect(screen.getByText("@kian_k")).toBeInTheDocument();
    expect(screen.getByTestId("friends-kian_k")).toHaveTextContent("دوستین");
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("falls back to the username when there is no name", () => {
    render(<PersonRow person={{ username: "raha", displayName: null, avatar: null, canPlay: true, friendship: "none", isFriend: false }} act={() => {}} />);
    expect(screen.getByText("raha")).toBeInTheDocument();
  });
});

describe("the badge on پیام‌ها counts the friend requests too", () => {
  it("adds the requests to the unread messages, and says each", () => {
    render(<TabBar current={0} unread={2} requests={3} />);
    const link = screen.getByRole("link", { name: /پیام‌ها/ });
    expect(link).toHaveAccessibleName("پیام‌ها ۲ پیام نخونده، ۳ درخواست دوستی");
    expect(link).toHaveTextContent("۵");
  });

  it("says only the requests when there are no messages", () => {
    render(<TabBar current={0} requests={1} />);
    expect(screen.getByRole("link", { name: /پیام‌ها/ })).toHaveAccessibleName("پیام‌ها ۱ درخواست دوستی");
  });
});
