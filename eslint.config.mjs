import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

function asConfigArray(config) {
  return Array.isArray(config) ? config : [config];
}

const eslintConfig = defineConfig([
  ...asConfigArray(nextVitals),
  ...asConfigArray(nextTs),
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
