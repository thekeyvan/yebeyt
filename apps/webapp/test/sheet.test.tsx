import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmSheet } from "../components/ui/ConfirmSheet";
import { Sheet } from "../components/ui/Sheet";

function matchWide(wide: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    (media) => ({ media, matches: wide, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  );
}

afterEach(() => matchWide(false));

describe("Sheet", () => {
  it("is a named dialog with a title, a line and its content when open", async () => {
    render(
      <Sheet open onOpenChange={() => {}} title="چی کار کنم؟" description="یکی را انتخاب کن.">
        <button>یکی</button>
      </Sheet>,
    );
    const dialog = await screen.findByRole("dialog", { name: "چی کار کنم؟" });
    expect(dialog).toHaveAccessibleDescription("یکی را انتخاب کن.");
    expect(dialog).toContainElement(screen.getByRole("button", { name: "یکی" }));
    expect(screen.getByTestId("grabber")).toBeInTheDocument();
  });

  it("lets a sheet set its own heading, which still names the dialog", async () => {
    render(
      <Sheet open onOpenChange={() => {}} header={(Title) => <div><span data-testid="icon" /><Title>برای پسند</Title></div>}>
        <button>یکی</button>
      </Sheet>,
    );
    const dialog = await screen.findByRole("dialog", { name: "برای پسند" });
    expect(dialog).toContainElement(screen.getByTestId("icon"));
  });

  it("renders nothing while closed", () => {
    render(<Sheet open={false} onOpenChange={() => {}} title="بسته" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a sheet on a phone and a dialog from 768 px", async () => {
    matchWide(false);
    const phone = render(<Sheet open onOpenChange={() => {}} title="تیتر" />);
    expect(await screen.findByRole("dialog")).toHaveAttribute("data-side", "bottom");
    expect(screen.getByTestId("grabber")).toBeInTheDocument();
    phone.unmount();
    matchWide(true);
    render(<Sheet open onOpenChange={() => {}} title="تیتر" />);
    // jsdom does not know popovers, so it counts the centred dialog as hidden.
    expect(await screen.findByRole("dialog", { hidden: true })).not.toHaveAttribute("data-side");
    expect(screen.queryByTestId("grabber")).not.toBeInTheDocument();
  });

  it("asks to close on Escape", async () => {
    const onOpenChange = vi.fn();
    render(<Sheet open onOpenChange={onOpenChange} title="تیتر" />);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});

describe("ConfirmSheet", () => {
  it("puts the safe button first (on the right) and the red one after it", async () => {
    render(<ConfirmSheet open onOpenChange={() => {}} title="بری بیرون؟" message="پیشرفتت از بین می‌ره." confirm="برو بیرون" cancel="بمون" onConfirm={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["بمون", "برو بیرون"]);
    expect(buttons[1]).toHaveClass("bg-fire");
    expect(dialog).toHaveAccessibleDescription("پیشرفتت از بین می‌ره.");
  });

  it("says «نه» on the safe button unless told otherwise", async () => {
    render(<ConfirmSheet open onOpenChange={() => {}} title="مطمئنی؟" confirm="حذف کن" onConfirm={() => {}} />);
    expect(await screen.findByRole("button", { name: "نه" })).toBeInTheDocument();
  });

  it("does nothing but close on the safe button", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmSheet open onOpenChange={onOpenChange} title="مطمئنی؟" confirm="حذف کن" onConfirm={onConfirm} />);
    await userEvent.click(await screen.findByRole("button", { name: "نه" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("runs the action, then closes, on the red button", async () => {
    const order: string[] = [];
    const onOpenChange = vi.fn(() => order.push("closed"));
    const onConfirm = vi.fn(async () => {
      await Promise.resolve();
      order.push("done");
    });
    render(<ConfirmSheet open onOpenChange={onOpenChange} title="مطمئنی؟" confirm="حذف کن" onConfirm={onConfirm} />);
    await userEvent.click(await screen.findByRole("button", { name: "حذف کن" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(order).toEqual(["done", "closed"]);
  });
});
