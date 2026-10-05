"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

/** Toasts inherit the app theme and sit above the mobile bottom bar. */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") ?? "light"}
      position="top-center"
      offset={16}
      duration={2600}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border-border !bg-card !text-foreground !shadow-[var(--shadow-lifted)]",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
