import { BarChart3, CalendarDays, Droplets, User } from "lucide-react";

/**
 * One navigation definition, rendered as a top bar on desktop and a bottom bar
 * on mobile. Keeping it in a single place is what stops the two drifting apart.
 */
export const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: Droplets },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
