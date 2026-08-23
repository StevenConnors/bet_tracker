import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: here });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", ".local/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
];
export default config;
