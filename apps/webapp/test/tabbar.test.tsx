import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TabBar } from "../components/ui/TabBar";

describe("TabBar", () => {
  it("has the five tabs in order, each linking to its route", () => {
    render(<TabBar current={null} />);
    const nav = screen.getByRole("navigation", { name: "تب‌ها" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["خونه", "کاوش", "بازی", "پیام‌ها", "من"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/explore", "/games", "/messages", "/me"]);
  });

  it("marks the open tab with aria-current and lapis, the others muted", () => {
    render(<TabBar current={1} />);
    const open = screen.getByRole("link", { name: "کاوش" });
    expect(open).toHaveAttribute("aria-current", "page");
    expect(open).toHaveClass("text-lapis");
    for (const name of ["خونه", "بازی", "پیام‌ها", "من"]) {
      const link = screen.getByRole("link", { name });
      expect(link).not.toHaveAttribute("aria-current");
      expect(link).toHaveClass("text-muted");
    }
  });

  it("marks nothing on a page outside the tabs", () => {
    render(<TabBar current={null} />);
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("shows the unread count on پیام‌ها in Persian digits, and says it to screen readers", () => {
    render(<TabBar current={0} unread={2} />);
    const messages = screen.getByRole("link", { name: /پیام‌ها/ });
    expect(within(messages).getByText("۲")).toBeInTheDocument();
    expect(messages).toHaveAccessibleName("پیام‌ها ۲ پیام نخونده");
  });

  it("shows no badge at zero", () => {
    render(<TabBar current={0} unread={0} />);
    expect(screen.getByRole("link", { name: "پیام‌ها" })).toBeInTheDocument();
  });
});
