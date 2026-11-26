/** «شاعرِ محبوب»: the poet with the most kept couplets, then the most read poems (Me/Divan/DivanLogic.swift `FavouritePoet`). */
const poetOf = (path: string): string | undefined => path.split("/").find((part) => part !== "");

function counts(paths: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const slug of paths.map(poetOf)) if (slug) result.set(slug, (result.get(slug) ?? 0) + 1);
  return result;
}

/** `kept` are divan keys («/hafez/g/sh1#0»), `read` poem paths. Undefined when there is nothing of either; equal counts go to the first slug. */
export function favouritePoet(kept: readonly string[], read: readonly string[]): string | undefined {
  const keptCounts = counts(kept);
  const readCounts = counts(read);
  const slugs = [...new Set([...keptCounts.keys(), ...readCounts.keys()])].sort();
  return slugs.reduce<string | undefined>((best, slug) => {
    if (best === undefined) return slug;
    const [a, b] = [keptCounts.get(slug) ?? 0, keptCounts.get(best) ?? 0];
    return a > b || (a === b && (readCounts.get(slug) ?? 0) > (readCounts.get(best) ?? 0)) ? slug : best;
  }, undefined);
}
