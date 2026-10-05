import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <span aria-hidden className="text-3xl">
          🔍
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">We couldn&rsquo;t find that page</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          The link may be old, or the page may have moved.
        </p>
        <Button asChild className="mt-7">
          <Link href="/today">Back to today</Link>
        </Button>
      </div>
    </div>
  );
}
