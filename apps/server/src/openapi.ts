import { createApp } from "./app.js";
import type { Deps } from "./deps.js";

/** Builds the OpenAPI document. Handlers are never called, so the dependencies can be empty. */
export function openApiDocument() {
  const app = createApp({} as Deps);
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: {
      title: "yebeyt API",
      version: "1.0.0",
      description: "Errors are `{ \"error\": code }`; the apps turn the codes into Persian copy.",
    },
    servers: [{ url: "https://api.yebeyt.com" }],
  });
}

export const renderOpenApi = (): string => `${JSON.stringify(openApiDocument(), null, 2)}\n`;
