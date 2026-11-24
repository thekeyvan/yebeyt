/** What a link page learned from the server: the thing, nothing (404), or no answer (down, slow, or an error). */
export type Lookup<T> = { status: "found"; data: T } | { status: "missing" } | { status: "unavailable" };

export async function lookup<T>(call: () => Promise<T | null>): Promise<Lookup<T>> {
  try {
    const data = await call();
    return data ? { status: "found", data } : { status: "missing" };
  } catch {
    return { status: "unavailable" };
  }
}
