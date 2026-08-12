// @ts-check
const eslint = require('@eslint/js')
const tseslint = require('typescript-eslint')
const angular = require('angular-eslint')
const globals = require('globals')

/** Rules shared by application and spec sources. */
const sharedRules = {
  '@angular-eslint/directive-selector': [
    'error',
    {
      type: 'attribute',
      prefix: 'app',
      style: 'camelCase',
    },
  ],
  '@angular-eslint/component-selector': [
    'error',
    {
      type: 'element',
      prefix: 'app',
      style: 'kebab-case',
    },
  ],
  'prefer-const': 'error',
  'no-var': 'error',
  quotes: ['error', 'single'],
  semi: ['error', 'never'],
  curly: 'error',
  eqeqeq: 'error',
  'no-unused-vars': 'off',

  // Both are new in angular-eslint 22's recommended set, and both want app
  // code changes rather than config changes: constructor DI would move to
  // inject(), and OnPush would alter when components actually re-render.
  // Left off so this stays a dependency upgrade; worth revisiting separately.
  '@angular-eslint/prefer-inject': 'off',
  '@angular-eslint/prefer-on-push-component-change-detection': 'off',
}

module.exports = tseslint.config(
  {
    ignores: ['projects/**/*', 'dist/**/*'],
  },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.app.json', 'tsconfig.spec.json'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
      },
    },
    rules: {
      ...sharedRules,
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jasmine,
        spyOnProperty: 'readonly',
        expectAsync: 'readonly',
      },
    },
    rules: {
      ...sharedRules,
      // Specs log freely while diagnosing failures.
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
)
