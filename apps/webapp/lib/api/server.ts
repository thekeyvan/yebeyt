import { createBff } from "./bff";
import { upstream } from "./upstream";

// One BFF for every route of the app: its refresh is shared between the requests that meet an expired token together, so they must all reach the same one.
// It is kept on `globalThis` because the routes may be built apart.
const shared = globalThis as { __beytBff?: ReturnType<typeof createBff> };

export const bff = (shared.__beytBff ??= createBff(upstream));
