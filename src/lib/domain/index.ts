/**
 * The domain layer: pure hydration logic with no framework, database or I/O
 * dependencies. Imported by the server services *and* by client components, so
 * the dashboard can recompute pace and reminders locally between fetches.
 */

export * from "./alert";
export * from "./goal";
export * from "./insights";
export * from "./pace";
export * from "./progress";
export * from "./reminder-engine";
export * from "./streak";
export * from "./time";
export * from "./units";
