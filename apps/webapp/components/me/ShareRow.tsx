"use client";

import { motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { messageOf } from "../../lib/account/api";
import { cn } from "../../lib/cn";
import { channels, shareUrl, type Channel, type SharePayload } from "../../lib/me/invite";
import { shareStory, storyFile } from "../../lib/me/shareStory";
import { usePress } from "../../lib/motion";
import { browserEnvironment, copy, send } from "../../lib/reader/send";
import { MessagesIcon } from "../ui/icons";
import { toast } from "../ui/Toast";
import { LinkIcon, MoreIcon, SmsIcon, StoryIcon, WhatsAppIcon } from "./icons";

const icons: Record<Channel["id"], ReactNode> = {
  sms: <SmsIcon size={22} lineWidth={2.2} />,
  telegram: <MessagesIcon size={22} lineWidth={2.2} />,
  whatsapp: <WhatsAppIcon size={22} lineWidth={2.2} />,
};

function Action({ title, id, lapis, disabled, onPress, children }: { title: string; id: string; lapis?: boolean; disabled: boolean; onPress: () => void; children: ReactNode }) {
  const press = usePress();
  return (
    <motion.button type="button" {...press} disabled={disabled} aria-label={title} data-testid={id} onClick={onPress} className="flex flex-1 flex-col items-center gap-[5px] disabled:opacity-50">
      <span className={cn("grid size-[50px] place-items-center rounded-full shadow-[0_2px_8px_rgba(20,17,43,0.1)]", lapis ? "bg-lapis text-white" : "bg-white text-ink")}>{children}</span>
      <span className="text-[11px] font-medium text-ink">{title}</span>
    </motion.button>
  );
}

/**
 * The row of ways to send the link: پیامک, تلگرام, واتس‌اپ, استوری, کپی لینک, بیشتر (Me/Invite/ShareRow.swift). The messengers open their compose page with the text;
 * «بیشتر» is the browser's share sheet, or copies the text where there is none; «استوری» shares the picture (or saves it). `payload` is undefined until there is a link.
 */
export function ShareRow({ payload, link }: { payload: SharePayload | undefined; link: string }) {
  const off = payload === undefined;
  const copied = () => toast("کپی شد");
  // The picture is drawn as soon as there is a link, so that the share sheet opens inside the tap.
  const story = useRef<Promise<File>>(undefined);
  const ready = useRef<File>(undefined);
  useEffect(() => {
    if (off) return;
    ready.current = undefined;
    story.current = storyFile(link);
    story.current.then(
      (file) => (ready.current = file),
      () => {}, // told when «استوری» is pressed
    );
  }, [off, link]);
  const shareStoryNow = () => {
    const failed = () => toast(messageOf(new Error("story")));
    if (ready.current) void shareStory(ready.current).catch(failed);
    else void story.current?.then(shareStory).catch(failed);
  };
  const open = (channel: Channel) => {
    if (!payload) return;
    const address = shareUrl(channel, payload);
    if (channel.id === "sms") window.location.assign(address);
    else window.open(address, "_blank", "noopener");
  };
  return (
    <div className="flex items-start gap-1">
      {channels.map((channel) => (
        <Action key={channel.id} title={channel.title} id={`channel-${channel.id}`} disabled={off} onPress={() => open(channel)}>
          {icons[channel.id]}
        </Action>
      ))}
      <Action title="استوری" id="story" disabled={off} onPress={shareStoryNow}>
        <StoryIcon size={22} />
      </Action>
      <Action title="کپی لینک" id="copy-link" lapis disabled={off} onPress={() => payload && void copy(payload.url, browserEnvironment(), copied)}>
        <LinkIcon size={22} lineWidth={2.2} />
      </Action>
      <Action title="بیشتر" id="more" disabled={off} onPress={() => payload && void send(payload.text, browserEnvironment(), copied)}>
        <MoreIcon size={22} lineWidth={2.2} />
      </Action>
    </div>
  );
}
