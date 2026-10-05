"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A settings card that saves its own section.
 *
 * Per-section saving keeps the blast radius of a failed request small and lets
 * each card own its own pending, error and confirmation state — so nothing on
 * this page is ever ambiguously "saved".
 */
export function SettingsSection({
  title,
  description,
  onSave,
  saveLabel = "Save changes",
  dirty = true,
  children,
}: {
  title: string;
  description?: string;
  onSave?: () => Promise<void>;
  saveLabel?: string;
  dirty?: boolean;
  children: React.ReactNode;
}) {
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    if (!onSave) return;
    setStatus("saving");
    setError(null);
    try {
      await onSave();
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2200);
    } catch (caught) {
      setStatus("idle");
      setError(caught instanceof Error ? caught.message : "We couldn't save that. Please try again.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        {children}

        {onSave && (
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} disabled={status === "saving" || !dirty}>
              {status === "saving" && <Loader2 className="animate-spin" aria-hidden />}
              {saveLabel}
            </Button>
            <span
              aria-live="polite"
              className={cn(
                "flex items-center gap-1.5 text-sm text-success transition-opacity",
                status === "saved" ? "opacity-100" : "opacity-0",
              )}
            >
              <Check className="size-4" aria-hidden />
              Saved
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** A labelled row: description on the left, control on the right. */
export function SettingsRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
