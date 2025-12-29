import Fastify from 'fastify';

import path from 'path';
import { fileURLToPath } from 'url';

import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';

import {
  type Chapter,
  type ChapterRepository,
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
    getById: (id: string): Lecture | undefined => {
      return db.prepare('SELECT * FROM lectures WHERE id = ?').get(id) as
        | Lecture
        | undefined;
    },
    create: (lecture: Omit<Lecture, 'id'>): Lecture => {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
      ).run(id, lecture.title, lecture.description);
      return { id, ...lecture };
    },
    update: (id: string, lecture: Omit<Lecture, 'id'>): Lecture | undefined => {
      const result = db
        .prepare(
          'UPDATE lectures SET title = ?, description = ? WHERE id = ?',
        )
        .run(lecture.title, lecture.description, id);
      if (result.changes === 0) return undefined;
      return { id, ...lecture };
    },
    delete: (id: string): boolean => {
      const result = db.prepare('DELETE FROM lectures WHERE id = ?').run(id);
      return result.changes > 0;
    },
  };
}

function createChapterRepository(): ChapterRepository {
  return {
    getByLectureId: (lectureId: string): Chapter[] => {
      return db
        .prepare('SELECT * FROM chapters WHERE lectureId = ? ORDER BY "order"')
        .all(lectureId) as Chapter[];
    },
    create: (chapter: Omit<Chapter, 'id'>): Chapter => {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO chapters (id, lectureId, title, body, association, "order") VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, chapter.lectureId, chapter.title, chapter.body, chapter.association, chapter.order);
      return { id, ...chapter };
    },
    update: (
      id: string,
      chapter: Partial<Omit<Chapter, 'id'>>,
    ): Chapter | undefined => {
      const existing = db
        .prepare('SELECT * FROM chapters WHERE id = ?')
        .get(id) as Chapter | undefined;
      if (!existing) return undefined;
      const updated = { ...existing, ...chapter };
      db.prepare(
        'UPDATE chapters SET title = ?, body = ?, association = ?, "order" = ? WHERE id = ?',
      ).run(updated.title, updated.body, updated.association, updated.order, id);
      return updated;
    },
    delete: (id: string): boolean => {
      const result = db.prepare('DELETE FROM chapters WHERE id = ?').run(id);
      return result.changes > 0;
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
  const chapterRepository = createChapterRepository();

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: createContext({ lectureRepository, chapterRepository }),
    },
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Serve static files from the 'public' directory
  // In Docker, we will copy the React build to 'public' relative to this script's execution context
  await server.register(staticPlugin, {
    root: path.join(__dirname, '../public'),
    prefix: '/',
  });

  // SPA fallback: Send index.html for any request that doesn't match an API route or static file
  server.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/trpc')) {
      reply.code(404).send({
        message: 'Endpoint not found',
        error: 'Not Found',
        statusCode: 404,
      });
      return;
    }
    reply.sendFile('index.html');
  });

  try {
    await server.listen({ port: 4000, host: '0.0.0.0' });
    console.log('Server running on http://localhost:4000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
