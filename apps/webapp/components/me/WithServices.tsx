"use client";

import type { ReactNode } from "react";
import type { Services } from "../../lib/account/services";
import { Screen } from "../shell/Screen";
import { useServices } from "../account/useServices";

/** What a Me screen needs from the browser (the stores read localStorage): `children` run once the page is in it; until then the screen is an empty page, so nothing jumps. */
export function WithServices({ children }: { children: (services: Services) => ReactNode }) {
  const services = useServices();
  return services ? <>{children(services)}</> : <Screen />;
}
