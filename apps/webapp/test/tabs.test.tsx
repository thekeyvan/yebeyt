import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs } from "../components/ui/Tabs";

const items = [
  { value: "a", label: "اول", content: <p>صفحه‌ی اول</p> },
  { value: "b", label: "دوم", content: <p>صفحه‌ی دوم</p> },
  { value: "c", label: "سوم", content: <p>صفحه‌ی سوم</p> },
];

describe("Tabs", () => {
  it("shows the first page, and the page of the tab that is chosen", async () => {
    render(<Tabs label="بخش‌ها" items={items} />);
    expect(screen.getByRole("tablist", { name: "بخش‌ها" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "اول" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("صفحه‌ی اول")).toBeVisible();
    expect(screen.queryByText("صفحه‌ی دوم")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "دوم" }));
    expect(screen.getByRole("tab", { name: "دوم" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("صفحه‌ی دوم")).toBeVisible();
    expect(screen.queryByText("صفحه‌ی اول")).not.toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    render(<div dir="rtl"><Tabs label="بخش‌ها" items={items} /></div>);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "دوم" })).toHaveAttribute("aria-selected", "true");
  });
});
