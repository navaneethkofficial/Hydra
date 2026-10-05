import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The mark: a droplet drawn as a rotated rounded square, so it reads as water
 * without a cartoon splash.
 */
export function DropletMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <path
          d="M12 3.2c3.4 3.9 6 7 6 10.1a6 6 0 1 1-12 0c0-3.1 2.6-6.2 6-10.1Z"
          fill="currentColor"
          fillOpacity="0.92"
        />
        <path
          d="M9.4 13.6a2.7 2.7 0 0 0 2.4 2.6"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5 rounded-lg", className)}
      aria-label="Hydra — home"
    >
      <DropletMark className="transition-transform duration-200 group-hover:scale-105" />
      <span className="text-[17px] font-semibold tracking-tight">Hydra</span>
    </Link>
  );
}
