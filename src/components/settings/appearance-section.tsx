"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/** Theme applies instantly and is stored per browser, so it needs no save button. */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown until hydration; render a neutral state first
  // so the server and client markup agree.
  const hydrated = useHydrated();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Applies on this device.</CardDescription>
      </CardHeader>

      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2.5">
          {OPTIONS.map(({ value, label, Icon }) => {
            const selected = hydrated && theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
