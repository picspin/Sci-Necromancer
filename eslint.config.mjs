import js from '@eslint/js';

export default [
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      '.husky/**',
      '.history/**',
      '.vscode-history/**',
      '.claude/**',
      'coverage/**',
      'scripts/**',
    ],
  },

  // Base config for all files
  js.configs.recommended,

  // JavaScript/TypeScript files
  {
    files: ['**/*.{js,jsx,ts,tsx,vue}'],
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'warn',
      'no-undef': 'off', // TypeScript handles this
    },
  },
];
