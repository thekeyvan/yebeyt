import { expect, test } from "@playwright/test";

// The debug sign-in answers inside the door only in a build made with NEXT_PUBLIC_DEV_PAGES=1. The second server of `playwright.config.ts` is a production build made
// without it and started with the variable set, which must not turn the stub on: `debug-` tokens go to the real server (which is not there: 502), not to a session.
const port = Number(process.env.E2E_PORT);
const spec = `debug-${Buffer.from(JSON.stringify({ username: "niloofar" })).toString("base64url")}`;

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-375", "one project is enough: it asks the servers, not a page");
});

const signIn = (request: import("@playwright/test").APIRequestContext, at: number) =>
  request.post(`http://localhost:${at}/auth/apple`, { headers: { origin: `http://localhost:${at}` }, data: { identityToken: spec, nonce: "n" } });

test("the debug sign-in works in the build made with the debug pages (the control)", async ({ request }) => {
  const answer = await signIn(request, port);
  expect(answer.status()).toBe(200);
  expect((await answer.json()).user.username).toBe("niloofar");
});

test("a production build made without them refuses the debug sign-in even when the variable is set on the running server", async ({ request }) => {
  const answer = await signIn(request, port + 1);
  expect(answer.status()).toBe(502);
  expect(answer.headers()["set-cookie"]).toBeUndefined();
});
