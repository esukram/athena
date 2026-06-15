import { config } from '@athena/eslint-config';

/**
 * The api package is the presentation/transport tier (tRPC). It may depend on
 * the domain (@athena/domain) but must not reach into infrastructure: no
 * direct database or server-framework imports. Persistence is reached only
 * through domain ports, implemented in apps/server.
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
              group: ['better-sqlite3', 'fastify', '@fastify/*'],
              message:
                'The api layer must not import infrastructure; depend on @athena/domain ports instead.',
            },
          ],
        },
      ],
    },
  },
];
