import { defineConfig, globalIgnores } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";

// Next 16 removed `next lint`; eslint-config-next@16 ships native flat config.
// The `/core-web-vitals` entry is exactly the old `.eslintrc.json`
// `"extends": "next/core-web-vitals"` (verified: exports a 4-element flat
// config array — next base + next/typescript + ignores + core-web-vitals rules).
export default defineConfig([
  // Gitignored local tooling state, never part of the old `next lint` scope
  // (which only covered app/, components/, lib/, src/ by default).
  globalIgnores([".zcode/", ".serena/", ".mimosa/", ".tools/", ".playwright-mcp/"]),
  ...coreWebVitals,
  {
    // eslint-config-next@16 spreads eslint-plugin-react-hooks@7's `recommended`
    // preset wholesale, pulling in the React-Compiler-powered rule suite that
    // did not exist in the previous dependency generation (v4/v5: only
    // rules-of-hooks + exhaustive-deps). Two of those new rules fire on this
    // codebase's deliberate, documented patterns, so they are restored to the
    // previous-generation semantics (off) until the codebase opts into them:
    //  - set-state-in-effect: flags the canonical external-system sync effects
    //    (localStorage/URL hydration in lib/workbench.ts, mounted flags in
    //    Toast/HomePageClient, DOM sync in ThemeToggle/CommandPalette,
    //    reset-on-open/route-change).
    //  - preserve-manual-memoization: flags the workbench sanitize + write-back
    //    architecture (Retirement/SeTax calculators) as "compilation skipped";
    //    the manual memos have complete, correct deps — this is a perf notice,
    //    not a correctness error.
    // The rest of the v7 compiler rules (purity, immutability, refs,
    // static-components, set-state-in-render, ...) stay active and pass.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    // eslintrc (used by `next lint`) did not report unused eslint-disable
    // directives by default; flat config changed the default to "warn".
    // Restore the previous behavior — see notes re: the stale `react/no-danger`
    // directive in components/Faq.tsx.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
]);
