import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation fails with no network.
 *
 * The important message: drinks logged offline are not lost — they are queued
 * on the device and sent as soon as the connection is back.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <span aria-hidden className="text-3xl">
          🌐
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">You&rsquo;re offline</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Anything you logged while offline is saved on this device and will sync the moment
          you&rsquo;re back.
        </p>
        <Button asChild className="mt-7">
          <Link href="/today">Try again</Link>
        </Button>
      </div>
    </div>
  );
}
