import { cn } from "@/lib/utils";

/**
 * Loading placeholder.
 *
 * Skeletons mirror the shape of the content that replaces them, so nothing
 * jumps when real data lands.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-secondary via-muted to-secondary bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
