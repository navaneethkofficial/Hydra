import Link from "next/link";

import { Logo } from "@/components/layout/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container-page flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <Logo />
          <p className="mt-2.5 max-w-sm text-sm text-muted-foreground text-pretty">
            A tiny assistant that quietly keeps you hydrated.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#reminders" className="text-muted-foreground transition-colors hover:text-foreground">
            Reminders
          </a>
          <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/register" className="font-medium text-primary hover:underline">
            Get started
          </Link>
        </nav>
      </div>

      <p className="container-page mt-8 text-center text-xs text-muted-foreground sm:text-left">
        Hydra is a habit companion, not a medical service. Daily targets are general guidance.
      </p>
    </footer>
  );
}
