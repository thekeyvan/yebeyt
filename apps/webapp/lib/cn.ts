/** Joins class names, leaving out what is false or empty. */
export const cn = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(" ");
