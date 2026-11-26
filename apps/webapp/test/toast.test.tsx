import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastHost, toast } from "../components/ui/Toast";

describe("Toast", () => {
  it("says its line", async () => {
    render(<ToastHost />);
    act(() => toast("از دیوانت برداشته شد"));
    expect(await screen.findByText("از دیوانت برداشته شد")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "برگردون" })).not.toBeInTheDocument();
  });

  it("offers an undo that runs", async () => {
    const run = vi.fn();
    render(<ToastHost />);
    act(() => toast("برداشته شد", { run }));
    await userEvent.click(await screen.findByRole("button", { name: "برگردون" }));
    expect(run).toHaveBeenCalledOnce();
  });
});
