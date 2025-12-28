import { z } from 'zod';

import { publicProcedure, router } from './trpc';
import type { Lecture } from './types';

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text} from Fastify + tRPC!`,
        timestamp: new Date().toISOString(),
      };
    }),
  getLectures: publicProcedure.query((): Lecture[] => {
    return [
      {
        id: '1',
        title: 'Introduction to React',
        description: 'Learn the basics of React, components, and state.',
        imageUrl: 'https://placehold.co/600x400',
        duration: '45 min',
      },
      {
        id: '2',
        title: 'Advanced TypeScript',
        description: 'Deep dive into Generics, Utility types, and more.',
        imageUrl: 'https://placehold.co/600x400',
        duration: '60 min',
      },
      {
        id: '3',
        title: 'Material Design 3',
        description: 'Building beautiful UIs with Google Material 3.',
        imageUrl: 'https://placehold.co/600x400',
        duration: '30 min',
      },
      {
        id: '4',
        title: 'Server-Side Rendering',
        description: 'Understanding SSR with Node.js and frameworks.',
        imageUrl: 'https://placehold.co/600x400',
        duration: '50 min',
      },
    ];
  }),
});

export type AppRouter = typeof appRouter;
