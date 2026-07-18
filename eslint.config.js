"use strict";

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "test-results/**",
      "engine-tests/projects/**",
      "tests/fixtures/migrations/**",
      "HybridTileStudio*.js",
      "HybridTileSchemasV18.js",
      "src/runtime/**"
    ]
  },
  {
    files: ["HybridTileGraft.js", "src/studio/**/*.js", "src/desktop/**/*.js", "scripts/**/*.js", "tests/**/*.js", "electron-*.js", "service-worker.js", "playwright.config.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.worker
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-with": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-self-assign": "error",
      "no-dupe-keys": "error",
      "no-useless-assignment": "off",
      "preserve-caught-error": "off",
      "valid-typeof": "error"
    }
  },
  {
    files: ["tests/**/*.js", "tests/**/*.mjs"],
    rules: {
      "no-eval": "off",
      "no-implied-eval": "off"
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  }
];
