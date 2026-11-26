import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { StickerCard } from "../components/ui/StickerCard";
import { WordSticker } from "../components/ui/WordSticker";

describe("Button", () => {
  it("is a lapis sticker by default, fire for danger and white for ghost", () => {
    render(
      <>
        <Button>بزن بریم</Button>
        <Button variant="fire">حذف کن</Button>
        <Button variant="ghost">بعداً</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "بزن بریم" })).toHaveClass("bg-lapis", "border-button", "border-white");
    expect(screen.getByRole("button", { name: "حذف کن" })).toHaveClass("bg-fire");
    const ghost = screen.getByRole("button", { name: "بعداً" });
    expect(ghost).toHaveClass("bg-white");
    expect(ghost).not.toHaveClass("border-button");
  });

  it("is not a submit button unless asked, and clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>برو</Button>);
    const button = screen.getByRole("button", { name: "برو" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("Badge", () => {
  it("writes counts in Persian digits", () => {
    render(
      <>
        <Badge kind="streak" value={7} />
        <Badge kind="points" value={2480} />
        <Badge kind="correct" />
        <Badge kind="decorative">حافظ · تزئینی</Badge>
      </>,
    );
    expect(screen.getByText("۷")).toHaveClass("bg-fire");
    expect(screen.getByText("۲٬۴۸۰")).toHaveClass("bg-amber");
    expect(screen.getByText("درست بود!")).toHaveClass("bg-green");
    expect(screen.getByText("حافظ · تزئینی")).toHaveClass("bg-magenta", "rotate-(--tilt-decorative)");
  });
});

describe("WordSticker", () => {
  it("is loose, stuck, held, correct or wrong", () => {
    render(
      <>
        <WordSticker word="الف" status="onSheet" />
        <WordSticker word="ب" status="stuck" />
        <WordSticker word="پ" status="held" />
        <WordSticker word="ت" status="correct" />
        <WordSticker word="ث" status="wrong" />
      </>,
    );
    expect(screen.getByText("الف")).toHaveClass("bg-white", "border-0");
    expect(screen.getByText("ب")).toHaveClass("bg-lapis", "border-word");
    expect(screen.getByText("پ")).toHaveClass("bg-fire", "rotate-(--tilt-word)", "scale-(--scale-held)");
    expect(screen.getByText("ت")).toHaveClass("bg-green");
    expect(screen.getByText("ث")).toHaveClass("bg-fire");
    expect(screen.getByText("ب")).not.toHaveClass("rotate-(--tilt-word)");
  });
});

describe("StickerCard", () => {
  it("has a white border, soft shadow and the card radius", () => {
    render(<StickerCard data-testid="card">متن</StickerCard>);
    expect(screen.getByTestId("card")).toHaveClass("border-card", "border-white", "rounded-card", "shadow-card", "bg-white");
  });
});
