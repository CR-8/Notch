import js from '@eslint/js';
import tsPlugin from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default tsPlugin.config(
  // Global ignores
  {
    ignores: ['.output/', '.wxt/', 'node_modules/', 'public/ort/', '*.config.*', 'scripts/'],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tsPlugin.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      'no-control-regex': 'off',
    },
  },

  // React rules
  {
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'],
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'error',
    },
  },

  // React Hooks rules
  {
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: reactHooksPlugin.configs.recommended.rules,
  },

  // Prettier (must be last to override formatting rules)
  prettierConfig,

  // Document system uses loose typing patterns — suppress no-unsafe-*
  {
    files: ['src/document-system/**', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // TipTap UI components — third-party patterns with loose typing
  {
    files: [
      'src/components/tiptap-*/**',
      'src/components/tiptap-ui/**',
      'src/components/tiptap-ui-primitive/**',
      'src/components/tiptap-node/**',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Reader components access refs during render for layout computation
  {
    files: ['src/components/reader/**'],
    rules: {
      'react-hooks/refs': 'off',
    },
  },
);
