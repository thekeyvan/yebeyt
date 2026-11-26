"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { opening, type GameKind } from "../../lib/games/kinds";
import { usePress } from "../../lib/motion";
import { useAccount } from "../account/AccountProvider";

const PressLink = motion.create(Link);

type GameLinkProps = { kind: GameKind; className?: string; style?: CSSProperties; label?: string; hint?: string; testId: string; children: ReactNode };

/**
 * A game's card or row: a link to its page; for a game with a friend, the account gate (those need the server) (`GameKind.route` and the catalog's `open` on iOS).
 */
export function GameLink({ kind, className, style, label, hint, testId, children }: GameLinkProps) {
  const press = usePress();
  const account = useAccount();
  const what = opening(kind);
  const shared = { ...press, className, style, "aria-label": label, "aria-description": hint, "data-testid": testId };
  if (typeof what === "object") return <PressLink href={what.page} {...shared}>{children}</PressLink>;
  return (
    <motion.button type="button" {...shared} onClick={() => account.require("games")}>
      {children}
    </motion.button>
  );
}
