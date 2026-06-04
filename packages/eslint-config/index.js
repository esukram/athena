import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    // Fail on `eslint-disable` directives that no longer suppress anything, so
    // stale suppressions can't silently accumulate after a plugin/rule upgrade
    // (exactly how the old react-hooks suppression in EditChapterModal became
    // dead). The repo is clean of unused directives as of this change.
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      }
    }
  }
];

export default config;
