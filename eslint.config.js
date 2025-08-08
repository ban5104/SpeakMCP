import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx,cjs,mjs}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        NodeJS: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'import': importPlugin,
    },
    rules: {
      // Disable problematic rules for now
      '@typescript-eslint/no-unused-vars': 'off', // Too many to clean up right now
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      
      // React specific rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/display-name': 'off',
      
      // General JavaScript/TypeScript rules
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'no-empty-pattern': 'off', // Allow empty destructuring patterns
      'no-case-declarations': 'off',
      'no-unreachable': 'warn',
      'no-unexpected-multiline': 'warn',
      'prefer-const': 'off',
      'no-var': 'error',
      
      // Import rules
      'import/order': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    files: ['src/main/**/*.{js,ts}', 'src/preload/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        // Electron main process globals
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    ignores: [
      'out/**',
      'dist/**',
      'resources/**',
      'node_modules/**',
      '*.config.{js,ts}',
      'build/**',
      'scripts/**',
      'speakmcp-rs/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
];