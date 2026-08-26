import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // React 19's compiler rules, held at warning rather than error (D-043).
    //
    // Both fire on code that is correct here and has no better form:
    //
    // set-state-in-effect — the SSR-safe hydration read. A component cannot know
    //   matchMedia("prefers-reduced-motion"), sessionStorage or a measured element
    //   width during render without breaking the server render, so it reads them in
    //   an effect and sets state once. That IS the cascading render the rule warns
    //   about; it is also the only way to do it. Four surfaces rely on it:
    //   NewsFader, TickerMarquee, RevealExperience and BetSlip.
    //
    // purity — Date.now() inside a SERVER component (app/admin/page.tsx) computing
    //   which games have gone stale. There is no render to be impure across.
    //
    // They stay ON as warnings so new code still gets told. They stop being errors
    // because an ERROR here failed `npm run lint`, and a failed lint step made CI
    // skip `npm test` entirely — 140 tests silently not running for three commits.
    // A gate that blocks the checks behind it is worse than no gate.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
