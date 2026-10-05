import { pathToFileURL } from "node:url";

const SRC_ROOT = pathToFileURL(`${process.cwd()}/src/`).href;
const EXTENSIONS = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  const mapped = specifier.startsWith("@/") ? `${SRC_ROOT}${specifier.slice(2)}` : specifier;

  try {
    return await nextResolve(mapped, context);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    for (const extension of EXTENSIONS) {
      try {
        return await nextResolve(`${mapped}${extension}`, context);
      } catch {
        // Try the next candidate extension.
      }
    }
    throw error;
  }
}
