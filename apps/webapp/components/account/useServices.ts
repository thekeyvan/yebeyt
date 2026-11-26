"use client";

import { useEffect, useState } from "react";
import { accountServices, type Services } from "../../lib/account/services";

/** The account's services once the page is in the browser (they read localStorage, so they are not there while it renders on the server). */
export function useServices(): Services | undefined {
  const [services, setServices] = useState<Services>();
  useEffect(() => setServices(accountServices()), []);
  return services;
}
