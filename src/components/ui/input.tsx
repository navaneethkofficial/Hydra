import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-card px-3.5 py-2 text-[15px] transition-shadow",
        "placeholder:text-muted-foreground/70",
        "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/15",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
