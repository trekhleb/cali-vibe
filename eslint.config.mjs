import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  js.configs.recommended,
  globalIgnores(["dist/**"]),
]);

export default eslintConfig;
