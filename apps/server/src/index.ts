import Fastify from 'fastify';

import cors from '@fastify/cors';
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
        'INSERT INTO lectures (id, title, subtitle, description) VALUES (?, ?, ?, ?)',
      ).run(id, lecture.title, lecture.subtitle, lecture.description);
      return { id, ...lecture };
    },
    update: (id: string, lecture: Omit<Lecture, 'id'>): Lecture | undefined => {
      const result = db
        .prepare(
          'UPDATE lectures SET title = ?, subtitle = ?, description = ? WHERE id = ?',
        )
        .run(lecture.title, lecture.subtitle, lecture.description, id);
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
        'INSERT INTO chapters (id, lectureId, title, body, "order") VALUES (?, ?, ?, ?, ?)',
      ).run(id, chapter.lectureId, chapter.title, chapter.body, chapter.order);
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
        'UPDATE chapters SET title = ?, body = ?, "order" = ? WHERE id = ?',
      ).run(updated.title, updated.body, updated.order, id);
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

  try {
    await server.listen({ port: 4000 });
    console.log('Server running on http://localhost:4000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
