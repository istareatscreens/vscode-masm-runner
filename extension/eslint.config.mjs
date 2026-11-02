import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

const TS = ["**/*.ts", "**/*.tsx"];

export default [
  { ignores: ["media/**", "out/**", "native/**", "node_modules/**"] },
  { ...js.configs.recommended, files: TS },
  ...tsPlugin.configs["flat/recommended"].map((config) => ({ ...config, files: TS })),
  {
    files: TS,
    plugins: { "@stylistic": stylistic },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@stylistic/semi": [2, "always"],
      "@typescript-eslint/no-unused-vars": 0,
      "@typescript-eslint/no-explicit-any": 0,
      "@typescript-eslint/explicit-module-boundary-types": 0,
      "@typescript-eslint/no-non-null-assertion": 0,
    },
  },
];
