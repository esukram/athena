import { config } from '@athena/eslint-config';

/**
 * The domain tier is the innermost layer: it must not import the presentation
 * layer (@athena/api), infrastructure (better-sqlite3, fastify), transport
 * (@trpc/*), UI libraries (react*), or even validation runtimes (zod). It has
 * zero runtime dependencies; invariants are enforced with value objects, not
 * an external schema library. This keeps the dependency arrows pointing inward
 * (presentation → domain ← infrastructure).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...config,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@athena/api', '@athena/api/*', 'server', 'web'],
              message:
                'Domain must not depend on the presentation/infrastructure layers.',
            },
            {
              group: ['@trpc/*', '@fastify/*', 'fastify', 'better-sqlite3'],
              message: 'Domain must not depend on transport or infrastructure.',
            },
            {
              group: ['react', 'react-dom', 'react-router-dom'],
              message: 'Domain must not depend on UI libraries.',
            },
            {
              group: ['zod'],
              message:
                'Domain has zero runtime dependencies; enforce invariants with value objects, not zod.',
            },
          ],
        },
      ],
    },
  },
];
