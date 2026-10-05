"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The app-wide error boundary.
 *
 * Friendly, specific about what to do next, and never showing a stack trace or
 * a status code to someone who just wanted to log a glass of water.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <span aria-hidden className="text-3xl">
          💧
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Your hydration data is safe. Let&rsquo;s try loading this again.
        </p>
        <Button className="mt-7" onClick={reset}>
          <RotateCw aria-hidden />
          Try again
        </Button>
      </div>
    </div>
  );
}
