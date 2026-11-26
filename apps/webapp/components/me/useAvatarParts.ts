"use client";

import type { AvatarParts } from "@yebeyt/avatar";
import type { Services } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";
import { standardParts } from "../../lib/me/avatarCatalogue";
import { useServices } from "../account/useServices";

/** The face to show: this browser's (the account's once reconciled); the standard one while the page is still on the server. A screen that already has the services passes them, so its first draw is right. */
export function useAvatarParts(known?: Services): AvatarParts {
  const found = useServices();
  return useStore((known ?? found)?.avatar) ?? standardParts;
}
