module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    '.eslintrc.js', 
    'dist/', 
    'build/',
    'node_modules/', 
    'coverage/',
    '**/*.test.ts', 
    '**/*.spec.ts',
    '*.d.ts',
    'vitest.config.ts'
  ],
  rules: {
    'no-unused-vars': 'off',
    'no-console': 'warn',
    'prefer-const': 'error',
  },
};