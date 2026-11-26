/** The five tabs, in the order of the tab bar (first at the right in right-to-left); each is its own route. */
export const tabs = [
  { title: "خونه", href: "/" },
  { title: "کاوش", href: "/explore" },
  { title: "بازی", href: "/games" },
  { title: "پیام‌ها", href: "/messages" },
  { title: "من", href: "/me" },
] as const;

/** The index of the tab a path belongs to (a tab's own pages count), or null for a path outside the tabs. */
export function tabAt(pathname: string): number | null {
  const index = tabs.findIndex(({ href }) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)));
  return index === -1 ? null : index;
}
