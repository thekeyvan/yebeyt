"use client";

import { useEffect } from "react";
import { useAccount } from "../account/AccountProvider";
import { useServices } from "../account/useServices";
import { useStore } from "../../lib/library/browser";

/**
 * The games with friends need an account: the services once there is a signed-in person (undefined before the page knows, and for a guest, who gets the gate and
 * goes ahead after the sign-in) (`account.require(.games)` on the phone).
 */
export function useSignedInServices() {
  const services = useServices();
  const account = useAccount();
  const status = useStore(services?.session)?.status;
  useEffect(() => {
    if (status === "guest") account.require("games");
  }, [status]);
  return status === "in" ? services : undefined;
}
