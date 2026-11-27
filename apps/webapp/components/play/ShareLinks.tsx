"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { channels, shareUrl, type Channel, type SharePayload } from "../../lib/me/invite";
import { usePress } from "../../lib/motion";
import { browserEnvironment, copy, send } from "../../lib/reader/send";
import { LinkIcon, MoreIcon, SmsIcon, WhatsAppIcon } from "../me/icons";
import { MessagesIcon } from "../ui/icons";
import { toast } from "../ui/Toast";

const icons: Record<Channel["id"], (size: number) => ReactNode> = {
  sms: (size) => <SmsIcon size={size} lineWidth={2.2} />,
  telegram: (size) => <MessagesIcon size={size} lineWidth={2.2} />,
  whatsapp: (size) => <WhatsAppIcon size={size} lineWidth={2.2} />,
};

function Action({ title, id, lapis, labelled, onPress, children }: { title: string; id: string; lapis?: boolean; labelled: boolean; onPress: () => void; children: ReactNode }) {
  const press = usePress();
  return (
    <motion.button type="button" {...press} aria-label={title} data-testid={id} onClick={onPress} className={cn("flex flex-col items-center gap-[5px]", labelled && "flex-1")}>
      <span className={cn("grid place-items-center rounded-full shadow-[0_2px_8px_rgba(20,17,43,0.1)]", labelled ? "size-[50px]" : "size-10", lapis ? "bg-lapis text-white" : "bg-white text-ink")}>{children}</span>
      {labelled && <span className="text-[11px] font-medium text-ink">{title}</span>}
    </motion.button>
  );
}

/**
 * The ways to send a link: پیامک, تلگرام, واتس‌اپ, کپی لینک, بیشتر (Me/Invite/ShareRow.swift without «استوری»). `prepare` makes the payload when a way is pressed (the game
 * or the challenge is made then): a messenger's page may be blocked by the browser when it opens after the wait, and pressing again then opens it, the payload being there.
 * `labelled` is the wide row with a name under each; otherwise the compact row of the lobby.
 */
export function ShareLinks({ prepare, labelled = false }: { prepare: () => Promise<SharePayload | undefined>; labelled?: boolean }) {
  const copied = () => toast("کپی شد");
  const run = (perform: (payload: SharePayload) => void) => async () => {
    const payload = await prepare();
    if (payload) perform(payload);
  };
  const icon = labelled ? 22 : 18;
  return (
    <div className="flex items-start gap-2.5" data-testid="share-links">
      {channels.map((channel) => (
        <Action
          key={channel.id}
          title={channel.title}
          id={`channel-${channel.id}`}
          labelled={labelled}
          onPress={run((payload) => {
            const address = shareUrl(channel, payload);
            if (channel.id === "sms") window.location.assign(address);
            else window.open(address, "_blank", "noopener");
          })}
        >
          {icons[channel.id](icon)}
        </Action>
      ))}
      <Action title="کپی لینک" id="copy-link" lapis labelled={labelled} onPress={run((payload) => void copy(payload.url, browserEnvironment(), copied))}>
        <LinkIcon size={icon} lineWidth={2.2} />
      </Action>
      <Action title="بیشتر" id="more" labelled={labelled} onPress={run((payload) => void send(payload.text, browserEnvironment(), copied))}>
        <MoreIcon size={icon} lineWidth={2.2} />
      </Action>
    </div>
  );
}
