import Fastify from 'fastify';

import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';

import {
  type Lecture,
  type LectureRepository,
  appRouter,
  createContext,
} from '@athena/api';

import { db } from './db';

function createLectureRepository(): LectureRepository {
  return {
    getAll: (): Lecture[] => {
      return db.prepare('SELECT * FROM lectures').all() as Lecture[];
    },
    create: (lecture: Omit<Lecture, 'id'>): Lecture => {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO lectures (id, title, subtitle, description) VALUES (?, ?, ?, ?)',
      ).run(id, lecture.title, lecture.subtitle, lecture.description);
      return { id, ...lecture };
    },
  };
}

const server = Fastify({
  logger: true,
});

async function main() {
  await server.register(cors, {
    origin: true, // Allow all origins for dev simplicity
  });

  const lectureRepository = createLectureRepository();

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: createContext({ lectureRepository }),
    },
  });

  try {
    await server.listen({ port: 4000 });
    console.log('Server running on http://localhost:4000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
