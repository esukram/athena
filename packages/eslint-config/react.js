import { config as baseConfig } from "./index.js";
import react from "eslint-plugin-react";
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
    plugins: {
      react,
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
    settings: {
      react: {
        // Pinned instead of "detect": eslint-plugin-react 7.37.5's version
        // detection calls the legacy context.getFilename(), removed in ESLint
        // 10, which crashes rule loading. Pinning skips detection entirely.
        version: "19.0",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      // Flat-config namespace for eslint-plugin-react-hooks v7. Equivalent rule
      // set to the legacy `configs.recommended.rules` accessor (verified), but
      // the canonical path for flat config — and deliberately not
      // `recommended-latest`, which pulls in newer/experimental rules.
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // React 17+ JSX Transform doesn't require React to be in scope
      "react/react-in-jsx-scope": "off",
    },
  },
];

export default config;
