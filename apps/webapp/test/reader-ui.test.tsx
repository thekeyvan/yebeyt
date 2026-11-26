import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountGateSheet, accountFeatures, type AccountFeature } from "../components/account/AccountGateSheet";
import { CoupletText } from "../components/reader/CoupletText";
import { MeaningCard } from "../components/reader/MeaningCard";
import { ProgressRail } from "../components/reader/ProgressRail";
import { MarkButton } from "../components/ui/MarkButton";
import { defaultSettings } from "../lib/reader/settings";

describe("AccountGateSheet (Account/AccountGateSheet.swift)", () => {
  const open = (feature: AccountFeature, onClose = () => {}) => render(<AccountGateSheet feature={feature} open onClose={onClose} />);

  it("says why: «برای <the feature> یه حساب لازمه», for each of the six features", async () => {
    for (const feature of Object.keys(accountFeatures) as AccountFeature[]) {
      const view = open(feature);
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent(`برای ${accountFeatures[feature]}`);
      expect(dialog).toHaveTextContent("یه حساب لازمه");
      view.unmount();
    }
  });

  it("has the Apple and Google buttons, which cannot be pressed yet, and says why", async () => {
    open("likes");
    expect(await screen.findByRole("button", { name: "ادامه با اپل" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ادامه با گوگل" })).toBeDisabled();
    expect(screen.getByText("ورود روی وب به‌زودی")).toBeInTheDocument();
    expect(screen.getByText(/با اپل یا گوگل، چند ثانیه طول می‌کشه/)).toBeInTheDocument();
  });

  it("closes with «بعداً»", async () => {
    const onClose = vi.fn();
    open("messages", onClose);
    await userEvent.click(await screen.findByRole("button", { name: "بعداً" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("MarkButton", () => {
  it("is a button with its label and state, and tells what its press did", async () => {
    const onPress = vi.fn(() => true);
    render(
      <MarkButton action="keep" label="نگه دار" selected={false} onPress={onPress}>
        <i />
      </MarkButton>,
    );
    const button = screen.getByRole("button", { name: "نگه دار" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("leaves a send without a pressed state", () => {
    render(
      <MarkButton action="send" label="بفرست" onPress={() => true}>
        <i />
      </MarkButton>,
    );
    expect(screen.getByRole("button", { name: "بفرست" })).not.toHaveAttribute("aria-pressed");
  });

  it("makes no particles when the press did not change anything (the gate opened instead)", async () => {
    render(
      <MarkButton action="like" label="پسند" selected={false} onPress={() => {}}>
        <i />
      </MarkButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "پسند" }));
    expect(screen.getByRole("button", { name: "پسند" }).querySelector("span.absolute")).toBeNull();
  });
});

describe("ProgressRail (Reader/ProgressRail.swift)", () => {
  const rail = (index: number, count: number) => render(<ProgressRail index={index} count={count} secondary="text-muted" track="bg-ring" />);

  it("has a bar for each couplet, the current one longer and the ones read in lapis, with «۲ از ۹»", () => {
    const { container } = rail(1, 9);
    expect(screen.getByRole("img", { name: "بیت ۲ از ۹" })).toBeInTheDocument();
    const bars = [...container.querySelectorAll("span.w-\\[5px\\]")];
    expect(bars).toHaveLength(9);
    expect(bars.map((bar) => bar.classList.contains("bg-lapis"))).toEqual([true, true, false, false, false, false, false, false, false]);
    expect(bars.map((bar) => bar.classList.contains("h-[22px]"))).toEqual([false, true, false, false, false, false, false, false, false]);
    expect(container).toHaveTextContent("۲ از ۹");
  });

  it("is one thin track, filled to the couplet, for a long poem", () => {
    const { container } = rail(9, 40);
    expect(container.querySelectorAll("span.w-\\[5px\\]")).toHaveLength(1);
    expect(container.querySelector<HTMLElement>("span.bg-lapis")?.style.height).toBe("25%");
    expect(container).toHaveTextContent("۱۰ از ۴۰");
  });
});

describe("MeaningCard (Reader/MeaningCard.swift)", () => {
  const card = (props: Partial<Parameters<typeof MeaningCard>[0]> = {}) =>
    render(<MeaningCard text="ساقی، شراب باقی‌مانده رو بده" ai={false} expanded={false} onExpand={() => {}} onExplainAI={() => {}} onClose={() => {}} {...props} />);

  it("shows «معنی» and the text, with a close button", async () => {
    const onClose = vi.fn();
    card({ onClose });
    expect(screen.getByRole("region", { name: "معنی" })).toHaveTextContent("ساقی، شراب باقی‌مانده رو بده");
    await userEvent.click(screen.getByRole("button", { name: "بستن معنی" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("has the sparkle only for a meaning an AI wrote, and it explains where the meaning comes from", async () => {
    const view = card();
    expect(screen.queryByRole("button", { name: "با کمک هوش مصنوعی" })).toBeNull();
    view.unmount();
    const onExplainAI = vi.fn();
    card({ ai: true, onExplainAI });
    await userEvent.click(screen.getByRole("button", { name: "با کمک هوش مصنوعی" }));
    expect(onExplainAI).toHaveBeenCalled();
  });
});

describe("CoupletText (Reader/CoupletText.swift)", () => {
  const couplet = { m1: "اول", m2: "دوم" };

  it("has the two hemistichs, one at the start and one at the end when staggered, and both in the middle when centred", () => {
    const view = render(<CoupletText couplet={couplet} settings={defaultSettings} size={21} />);
    expect(screen.getByRole("group", { name: "اول، دوم" })).toBeInTheDocument();
    expect([...view.container.querySelectorAll("[aria-hidden]")].map((line) => line.className)).toEqual(["text-start", "text-end"]);
    view.rerender(<CoupletText couplet={couplet} settings={{ ...defaultSettings, layout: "centered" }} size={21} />);
    expect([...view.container.querySelectorAll("[aria-hidden]")].map((line) => line.className)).toEqual(["text-center", "text-center"]);
  });

  it("draws a single-line couplet as one line, at the board's size and line height", () => {
    const view = render(<CoupletText couplet={{ m1: "نثر", m2: "" }} settings={defaultSettings} size={21} />);
    expect(view.container.querySelectorAll("[aria-hidden]")).toHaveLength(1);
    const { style } = screen.getByRole("group");
    expect([style.fontSize, style.lineHeight]).toEqual(["21px", "2.1"]);
  });
});
