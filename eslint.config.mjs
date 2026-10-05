import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Next's flat config, applied directly — no eslintrc compatibility layer.
 * Generated Prisma output and build artefacts are not ours to lint.
 */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "public/sw.js", "next-env.d.ts"],
  },
];

export default config;
