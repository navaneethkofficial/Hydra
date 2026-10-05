/**
 * Volume handling.
 *
 * Millilitres are the only unit that ever crosses a boundary — API, database,
 * domain maths. Ounces exist purely as presentation, converted at the edge.
 */

export type Unit = "ML" | "OZ";

const ML_PER_OZ = 29.5735;

export function mlToOz(ml: number): number {
  return ml / ML_PER_OZ;
}

export function ozToMl(oz: number): number {
  return Math.round(oz * ML_PER_OZ);
}

/** Serving presets offered by the quick-add row, in millilitres. */
export const SERVING_PRESETS_ML = [150, 250, 350, 500] as const;

/** Rough real-world equivalents, so ounce users get familiar numbers. */
export const SERVING_PRESETS_OZ_ML = [150, 250, 350, 500] as const;

export function servingPresets(unit: Unit): readonly number[] {
  return unit === "OZ" ? SERVING_PRESETS_OZ_ML : SERVING_PRESETS_ML;
}

/**
 * A short label for a single serving — `"250 ml"` / `"8 oz"`.
 * Ounces are rounded to whole numbers; nobody pours 8.45 oz.
 */
export function formatServing(ml: number, unit: Unit): string {
  if (unit === "OZ") return `${Math.round(mlToOz(ml))} oz`;
  return `${Math.round(ml)} ml`;
}

/**
 * A label for a daily total — `"1.5 L"` / `"84 oz"`.
 * Litres keep one decimal because that is how people talk about a day.
 */
export function formatVolume(ml: number, unit: Unit): string {
  if (unit === "OZ") {
    const oz = mlToOz(ml);
    return `${oz >= 100 ? Math.round(oz) : round(oz, 1)} oz`;
  }
  if (ml < 1000) return `${Math.round(ml)} ml`;
  return `${round(ml / 1000, 1)} L`;
}

/** Value and unit split apart, for typographic layouts. */
export function splitVolume(ml: number, unit: Unit): { value: string; suffix: string } {
  if (unit === "OZ") {
    const oz = mlToOz(ml);
    return { value: String(oz >= 100 ? Math.round(oz) : round(oz, 1)), suffix: "oz" };
  }
  if (ml < 1000) return { value: String(Math.round(ml)), suffix: "ml" };
  return { value: round(ml / 1000, 1).toFixed(1), suffix: "L" };
}

/** Rounds to a tidy pour size so suggestions never read `237 ml`. */
export function roundToServing(ml: number, step = 50): number {
  return Math.max(step, Math.round(ml / step) * step);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
