"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydration } from "@/hooks/use-hydration";
import { formatServing, mlToOz, ozToMl, servingPresets } from "@/lib/domain/units";
import { cn } from "@/lib/utils";

/**
 * One-tap logging — the single most-used control in the product.
 *
 * The user's default serving gets the big primary button; the other presets sit
 * beside it. Nothing here opens a dialog, asks for confirmation or waits for the
 * network: tap, and the number moves.
 */
export function QuickAdd({ className }: { className?: string }) {
  const { today, logWater } = useHydration();
  const { unit, defaultServing } = today.profile;

  // Exactly three, so the row is always the big button plus a four-cell grid —
  // a custom default serving must not push "Custom" onto a second line.
  const presets = servingPresets(unit)
    .filter((amount) => amount !== defaultServing)
    .slice(0, 3);

  return (
    <div className={cn("space-y-2.5", className)}>
      <Button
        size="lg"
        block
        className="h-14 text-base"
        onClick={() => void logWater(defaultServing)}
      >
        <Plus aria-hidden />
        {formatServing(defaultServing, unit)}
      </Button>

      <div className="grid grid-cols-4 gap-2.5">
        {presets.map((amount) => (
          <Button
            key={amount}
            variant="outline"
            className="h-12 px-1 text-[13px] font-semibold"
            onClick={() => void logWater(amount)}
          >
            <span aria-hidden>+{unit === "OZ" ? Math.round(mlToOz(amount)) : amount}</span>
            <span className="sr-only">Log {formatServing(amount, unit)}</span>
          </Button>
        ))}
        <CustomAmountDialog />
      </div>
    </div>
  );
}

function CustomAmountDialog() {
  const { today, logWater } = useHydration();
  const { unit } = today.profile;

  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const amountMl = React.useMemo(() => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const ml = unit === "OZ" ? ozToMl(parsed) : Math.round(parsed);
    return ml >= 10 && ml <= 3000 ? ml : null;
  }, [value, unit]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (amountMl === null) return;
    void logWater(amountMl, "MANUAL");
    setValue("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12 px-1 text-[13px] font-semibold">
          Custom
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a custom amount</DialogTitle>
          <DialogDescription>
            A bottle, a mug, whatever you actually drank.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field
            label={`Amount in ${unit === "OZ" ? "fluid ounces" : "millilitres"}`}
            htmlFor="custom-amount"
            error={value && amountMl === null ? "Enter an amount between 10 ml and 3 L." : undefined}
          >
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              placeholder={unit === "OZ" ? "12" : "330"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={amountMl === null}>
              Log {amountMl ? formatServing(amountMl, unit) : "drink"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
