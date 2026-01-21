import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "**/vendor/**",
    "**/*.min.js"
  ]),
  {
    files: ["**/*.js"],
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
      // Auto-fixable formatting rules
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'eqeqeq': 'error',
      'indent': ['error', 2],
      'space-before-blocks': 'error',
      'space-before-function-paren': ['error', 'never'],
      'keyword-spacing': 'error',
      'object-curly-spacing': ['error', 'always'],
      'comma-dangle': ['error', 'never'],

      // Non-fixable rules (warnings to avoid breaking build)
      'no-unused-vars': ['warn', { 'args': 'none', 'varsIgnorePattern': '^_' }],
      'no-undef': 'error',
      'no-console': 'warn',
      'curly': 'error',
      'brace-style': ['error', '1tbs']
    }
  }
]);
