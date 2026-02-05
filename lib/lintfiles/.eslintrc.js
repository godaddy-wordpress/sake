import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "**/vendor/**",
    "**/*.min.js"
  ]),
  {
    files: ["**/*.js"],
    plugins: {
      js,
    },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        jQuery: 'readonly',
        $: 'readonly',
        console: 'readonly',
        define: 'readonly',
        require: 'readonly'
      }
    },
    rules: {
      'semi': ['error', 'always'],
      'space-before-blocks': 'error',
      'space-before-function-paren': ['error', 'never'],
      'keyword-spacing': 'error',
      'object-curly-spacing': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { 'args': 'none', 'varsIgnorePattern': '^_' }],
    }
  }
]);
