import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

const config = [
  { ignores: [".next/**", "node_modules/**"] },
  ...compat.config({ extends: ["eslint:recommended", "next/core-web-vitals"] }),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "no-unused-vars": "warn",
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
