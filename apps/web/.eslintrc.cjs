module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    // `while (true)` is a legit pattern for stream readers and event loops;
    // exempt it so the rule still catches `if (true)` style mistakes.
    'no-constant-condition': ['error', { checkLoops: false }],
    // Allow `_` / `_foo` for intentionally-discarded destructured keys and
    // unused function parameters — this is the canonical convention and
    // pretending those are bugs just trains people to add eslint-disables.
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
  },
  // ── Module-First import boundaries (Clean Architecture: domain ← infrastructure ← presentation).
  // Warn mode: surfaces layer violations without breaking the build, so existing
  // drift is visible and new regressions are caught in review. See
  // docs/architecture/web-structure/proposal.md § Enforcement.
  // NOTE: the cross-module "only reach other modules through their barrel" rule is
  // NOT expressible with no-restricted-imports (it can't tell same-module from
  // cross-module). It is enforced by convention today; adopting eslint-plugin-boundaries
  // is the tracked follow-up (proposal § 7, migration step 4).
  overrides: [
    {
      // Chakra UI v3 snippets — design-system primitives that intentionally
      // co-locate hook + component + type exports (the upstream shape). Exempt
      // from the HMR-oriented react-refresh rule; they are vendored building
      // blocks, not feature components.
      files: ['src/components/ui/**/*.{ts,tsx}'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      // domain is pure — no framework, no other layers.
      files: ['src/modules/*/domain/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'warn',
          {
            patterns: [
              {
                group: [
                  '@/modules/*/infrastructure/**',
                  '**/infrastructure/**',
                ],
                message:
                  'domain must not import infrastructure (Clean Architecture: domain ← infrastructure ← presentation).',
              },
              {
                group: [
                  '@/modules/*/presentation/**',
                  '**/presentation/**',
                ],
                message: 'domain must not import presentation.',
              },
            ],
          },
        ],
      },
    },
    {
      // presentation reaches repositories through core/di + a hook, never infrastructure directly.
      files: ['src/modules/*/presentation/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'warn',
          {
            patterns: [
              {
                group: [
                  '@/modules/*/infrastructure/**',
                  '**/infrastructure/**',
                ],
                message:
                  'presentation must not import infrastructure directly — resolve the repository via core/di and consume it through a hook.',
              },
            ],
          },
        ],
      },
    },
  ],
};
