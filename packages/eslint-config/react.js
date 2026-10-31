import { config as baseConfig } from "./index.js";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

/**
 * A custom ESLint configuration for libraries that use React.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...baseConfig,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    ...eslintReact.configs["recommended-typescript"],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Flat-config namespace for eslint-plugin-react-hooks v7. Equivalent rule
      // set to the legacy `configs.recommended.rules` accessor (verified), but
      // the canonical path for flat config — and deliberately not
      // `recommended-latest`, which pulls in newer/experimental rules.
      ...reactHooks.configs.flat.recommended.rules,
      // eslint-plugin-react-hooks stays the source of truth for hook and React
      // Compiler rules; switch off @eslint-react's copies so nothing reports twice.
      "@eslint-react/error-boundaries": "off",
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/purity": "off",
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/set-state-in-render": "off",
      "@eslint-react/static-components": "off",
      "@eslint-react/unsupported-syntax": "off",
      "@eslint-react/use-memo": "off",
      // ponytail: preset rules that flag existing code, off until adopted (#293).
      "@eslint-react/naming-convention-ref-name": "off",
      "@eslint-react/no-array-index-key": "off",
      "@eslint-react/no-context-provider": "off",
      "@eslint-react/no-forward-ref": "off",
      "@eslint-react/no-use-context": "off",
      "@eslint-react/use-state": "off",
      "@eslint-react/web-api-no-leaked-timeout": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];

export default config;
