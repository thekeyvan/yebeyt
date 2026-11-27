"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { opening, type GameKind } from "../../lib/games/kinds";
import { usePress } from "../../lib/motion";
import { lobbyURL } from "../../lib/play/routes";
import { useAccount } from "../account/AccountProvider";

const PressLink = motion.create(Link);

type GameLinkProps = { kind: GameKind; className?: string; style?: CSSProperties; label?: string; hint?: string; testId: string; children: ReactNode };

/**
 * A game's card or row: a link to its page; for a game with a friend, the account gate (those need the server) and then the lobby with that game chosen (`GameKind.route` and the catalog's `open` on iOS).
 */
export function GameLink({ kind, className, style, label, hint, testId, children }: GameLinkProps) {
  const press = usePress();
  const account = useAccount();
  const router = useRouter();
  const what = opening(kind);
  const shared = { ...press, className, style, "aria-label": label, "aria-description": hint, "data-testid": testId };
  if ("page" in what) return <PressLink href={what.page} {...shared}>{children}</PressLink>;
  return (
    <motion.button type="button" {...shared} onClick={() => account.require("games", () => router.push(lobbyURL({ game: what.lobby })))}>
      {children}
    </motion.button>
  );
}
