"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Theme, persisted per browser.
 *
 * Light is the default look of the product, so that is what a first visit gets
 * regardless of the OS setting; "System" is one tap away in the profile, and is
 * honoured from then on.
 *
 * `disableTransitionOnChange` stops every colour on the page animating at once
 * when the theme flips, which reads as a glitch rather than a transition.
 */
export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
