"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and the first client render, true afterwards.
 *
 * The correct primitive for "this value only exists in the browser": it keeps
 * the server and client markup identical on the first pass, so nothing
 * hydration-mismatches, without a setState-in-effect round trip.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
