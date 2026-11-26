"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { ConfirmSheet } from "../../../../components/ui/ConfirmSheet";
import { ExploreIcon, GamesIcon, HomeIcon, MeIcon, MessagesIcon } from "../../../../components/ui/icons";
import { Sheet } from "../../../../components/ui/Sheet";
import { StickerCard } from "../../../../components/ui/StickerCard";
import { Tabs } from "../../../../components/ui/Tabs";
import { toast } from "../../../../components/ui/Toast";
import { WordSticker, type WordStatus } from "../../../../components/ui/WordSticker";

const words: [string, WordStatus][] = [["گوهرند", "onSheet"], ["گوهرند", "stuck"], ["گوهرند", "held"], ["گوهرند", "correct"], ["گوهرند", "wrong"]];
const items = Array.from({ length: 40 }, (_, index) => index + 1);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 flex flex-col gap-3">
      <h2 className="text-[22px]">{title}</h2>
      {children}
    </section>
  );
}

export function Playground() {
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [longConfirm, setLongConfirm] = useState(false);
  const [undone, setUndone] = useState(false);

  return (
    <>
      <Section title="کارت">
        <StickerCard className="p-4">یه کارت سفید با حاشیه‌ی سفید و سایه‌ی نرم.</StickerCard>
      </Section>

      <Section title="دکمه و بج">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button>بزن بریم</Button>
          <Button variant="fire">حذف کن</Button>
          <Button variant="ghost">بعداً</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge kind="streak" value={7} />
          <Badge kind="points" value={2480} />
          <Badge kind="correct" />
          <Badge kind="decorative">حافظ · تزئینی</Badge>
        </div>
      </Section>

      <Section title="برچسبِ کلمه">
        <div className="flex flex-wrap items-center gap-3">
          {words.map(([word, status]) => (
            <WordSticker key={status} word={word} status={status} />
          ))}
        </div>
      </Section>

      <Section title="آیکون‌ها">
        <div className="flex gap-4 text-lapis">
          <HomeIcon />
          <ExploreIcon />
          <GamesIcon />
          <MessagesIcon />
          <MeIcon />
        </div>
      </Section>

      <Section title="تب">
        <Tabs
          label="نمونه"
          items={[
            { value: "a", label: "اول", content: <p>صفحه‌ی اول</p> },
            { value: "b", label: "دوم", content: <p>صفحه‌ی دوم</p> },
            { value: "c", label: "سوم", content: <p>صفحه‌ی سوم</p> },
          ]}
        />
      </Section>

      <Section title="برگه، پرسش و پیام">
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => setSheet(true)}>باز کردن برگه</Button>
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            باز کردن پرسش
          </Button>
          <Button variant="ghost" onClick={() => setLongConfirm(true)}>
            پرسش با نوشته‌ی بلند
          </Button>
          <Button variant="ghost" onClick={() => toast("یه پیام کوتاه")}>
            نشون بده
          </Button>
          <Button variant="ghost" onClick={() => toast("از دیوانت برداشته شد", { run: () => setUndone(true) })}>
            با برگردون
          </Button>
        </div>
        {undone && <p role="status">برگشت.</p>}
      </Section>

      <Sheet open={sheet} onOpenChange={setSheet} title="یه برگه" description="این برگه رو می‌شه کشید پایین تا بسته بشه.">
        <Button onClick={() => setSheet(false)}>باشه</Button>
      </Sheet>
      <ConfirmSheet
        open={confirm}
        onOpenChange={setConfirm}
        title="از دیوانت برداری؟"
        message="می‌تونی دوباره اضافه‌اش کنی."
        confirm="بردار"
        onConfirm={() => toast("برداشته شد")}
      />
      <ConfirmSheet
        open={longConfirm}
        onOpenChange={setLongConfirm}
        title="همه‌اش پاک بشه؟"
        confirm="همه‌ی بیت‌های دیوانم را پاک کن"
        cancel="نه، بمون"
        onConfirm={() => {}}
      />

      <Section title="خوانش">
        <Link href="/poem/hafez/ghazal/sh3?c=1" className="text-lapis underline">
          باز کردن غزل ۳ حافظ
        </Link>
      </Section>

      <Section title="یه فهرست بلند">
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item}>
              <StickerCard className="px-4 py-2" id={item === items.length ? "last-item" : undefined}>
                ردیف شماره‌ی {item}
              </StickerCard>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
