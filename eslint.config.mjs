import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Honor the `_`-prefix convention for intentional discards (e.g. stripping
      // id/matchId off a Prisma row via rest before re-creating it).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
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
    // Standalone Capacitor iOS project — its own deps, built on the Mac.
    "native/**",
  ]),
]);

export default eslintConfig;
