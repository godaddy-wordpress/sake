import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jsdoc from "eslint-plugin-jsdoc";

export default defineConfig([
  globalIgnores([
    "**/vendor/**",
    "**/*.min.js"
  ]),
  {
    ...js.configs.recommended,
    files: ["**/*.js"],
    plugins: {
      js,
      jsdoc,
    },
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
      'array-bracket-spacing': ['error', 'always', { 'arraysInArrays': true }],
      'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true, 'align': 'value' }],
      'space-in-parens': ['error', 'always'],
      'camelcase': ['error', { 'properties': 'never' }],
      'eqeqeq': 'warn',
      'no-multiple-empty-lines': 'warn',
      'padding-line-between-statements': [
        'warn',
        { 'blankLine': 'always', 'prev': 'directive', 'next': '*' },
        { 'blankLine': 'any', 'prev': 'directive', 'next': 'directive' },
        { 'blankLine': 'always', 'prev': ['class', 'function'], 'next': '*' },
        { 'blankLine': 'any', 'prev': ['const', 'let', 'var'], 'next': ['const', 'let', 'var'] },
        { 'blankLine': 'always', 'prev': '*', 'next': ['if', 'switch', 'while', 'for', 'throw', 'continue', 'return', 'block-like', 'multiline-block-like', 'multiline-expression'] },
        { 'blankLine': 'always', 'prev': ['if', 'switch', 'while', 'for', 'block-like', 'multiline-block-like', 'multiline-expression'], 'next': '*' }
      ],
      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-indentation': 'warn',
      'jsdoc/check-param-names': 'warn',
      'jsdoc/check-tag-names': 'warn',
      'jsdoc/require-description': 'warn',
      'jsdoc/require-jsdoc': 'warn',
      'jsdoc/require-param': 'warn',
      'jsdoc/require-param-name': 'warn',
      'jsdoc/require-param-type': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/require-returns-check': 'warn',
      'jsdoc/require-returns-type': 'warn'
    },
    settings: {
      jsdoc: {
        mode: 'jsdoc',
        ignorePrivate: true
      }
    }
  }
]);
