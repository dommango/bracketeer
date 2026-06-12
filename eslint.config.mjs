import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "generated/**",
    ".claude/**",
    ".superpowers/**",
    // Design-reference bundle (plain JSX, not app code) — see design/fifa26-handoff/README.md.
    "design/**",
  ]),
]);

export default eslintConfig;
