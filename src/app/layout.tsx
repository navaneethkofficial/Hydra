import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistrar } from "@/components/layout/service-worker-registrar";
import { env } from "@/server/env";

import "./globals.css";

/**
 * One variable font, self-hosted by `next/font` — no render-blocking request to
 * a third party, and no flash of fallback text.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: "Hydra — Drink water. Without having to remember.",
    template: "%s · Hydra",
  },
  description:
    "A simple hydration companion that reminds you when to drink, tracks your progress, and helps you build a consistent daily habit.",
  applicationName: "Hydra",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hydra", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    title: "Hydra — Drink water. Without having to remember.",
    description:
      "Simple tracking, intelligent reminders, and meaningful progress insights. Build a hydration habit that sticks.",
    siteName: "Hydra",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fbfe" },
    { media: "(prefers-color-scheme: dark)", color: "#111a24" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-dvh font-sans antialiased">
        <ThemeProvider>
          {/* Every page starts with a way past the navigation. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Skip to content
          </a>
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
