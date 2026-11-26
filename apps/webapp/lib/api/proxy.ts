/** The slug of a poet in the server's address: lower case letters, digits, «_» and «-». */
const slug = /^[a-z0-9_-]{1,40}$/;

/** The version of a picture, which makes its address new when the picture changes. */
const version = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The only paths the web app's `/api` route passes on, and only for GET (W2): the list of poet pictures and one poet's picture. `segments` are
 * the path's parts after `/api`, as Next gives them (decoded). Every part is checked on its own and the address is built from the checked
 * parts, so nothing a visitor sends can make it point anywhere else on the server. W4 widens this with the session.
 */
export function upstreamPath(segments: string[]): string | undefined {
  const [first, second, third, fourth, ...rest] = segments;
  if (first !== "v1" || second !== "poets" || rest.length > 0) return undefined;
  if (third === "pictures" && fourth === undefined) return "/v1/poets/pictures";
  if (third !== undefined && slug.test(third) && fourth === "picture") return `/v1/poets/${third}/picture`;
  return undefined;
}

/** The query that goes with the path: only `v`, the picture's version. */
export function upstreamQuery(search: URLSearchParams): string {
  const value = search.get("v");
  return value !== null && version.test(value) ? `?v=${value}` : "";
}
