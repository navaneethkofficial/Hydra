/**
 * Test-only module resolver.
 *
 * The source tree uses bundler-style extensionless imports (`./units`), which
 * Next resolves natively but Node's ESM loader does not. This hook retries a
 * failed resolution with `.ts`/`.tsx`, and maps the `@/` alias, so the domain
 * layer can be unit-tested by `node --test` without a bundler in the loop.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./test-resolver-hooks.mjs", pathToFileURL(`${import.meta.dirname}/`));
