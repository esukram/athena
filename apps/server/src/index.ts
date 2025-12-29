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
  type Question,
  type QuestionRepository,
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
    getDistinctAssociations: (): string[] => {
      const rows = db
        .prepare("SELECT DISTINCT association FROM chapters WHERE association != '' ORDER BY association")
        .all() as { association: string }[];
      return rows.map(row => row.association);
    },
    search: (query: string): (Chapter & { firstQuestion?: Question })[] => {
      if (!query.trim()) return [];
      
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return [];
      
      // Search in questions (question text) and chapters (association)
      // Use aliases for the main query
      const questionConditions = tokens.map(() => 
        'LOWER(q.question) LIKE ?'
      ).join(' AND ');
      
      const associationConditions = tokens.map(() => 
        'LOWER(c.association) LIKE ?'
      ).join(' AND ');
      
      const questionParams = tokens.map(token => `%${token}%`);
      const associationParams = tokens.map(token => `%${token}%`);
      
      // Get chapters that match via ANY question or association
      const chapters = db
        .prepare(`
          SELECT DISTINCT c.* FROM chapters c
          LEFT JOIN questions q ON q.chapterId = c.id
          WHERE (${questionConditions}) OR (${associationConditions})
          ORDER BY c."order"
        `)
        .all(...questionParams, ...associationParams) as Chapter[];
      
      // Conditions for finding the matching question within a specific chapter
      const innerQuestionConditions = tokens.map(() => 
        'LOWER(question) LIKE ?'
      ).join(' AND ');

      // Attach the best matching question to each chapter
      return chapters.map(chapter => {
        // First try to find a question that matches the search query
        let firstQuestion = db
          .prepare(`SELECT * FROM questions WHERE chapterId = ? AND (${innerQuestionConditions}) LIMIT 1`)
          .get(chapter.id, ...questionParams) as Question | undefined;

        // If no question matches (match was on association), fall back to the actual first question
        if (!firstQuestion) {
          firstQuestion = db
            .prepare('SELECT * FROM questions WHERE chapterId = ? ORDER BY "order" LIMIT 1')
            .get(chapter.id) as Question | undefined;
        }

        return { ...chapter, firstQuestion };
      });
    },
    create: (chapter: Omit<Chapter, 'id'>): Chapter => {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO chapters (id, lectureId, association, "order") VALUES (?, ?, ?, ?)',
      ).run(id, chapter.lectureId, chapter.association, chapter.order);
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
        'UPDATE chapters SET association = ?, "order" = ? WHERE id = ?',
      ).run(updated.association, updated.order, id);
      return updated;
    },
    delete: (id: string): boolean => {
      const result = db.prepare('DELETE FROM chapters WHERE id = ?').run(id);
      return result.changes > 0;
    },
  };
}

function createQuestionRepository(): QuestionRepository {
  return {
    getByChapterId: (chapterId: string): Question[] => {
      return db
        .prepare('SELECT * FROM questions WHERE chapterId = ? ORDER BY "order"')
        .all(chapterId) as Question[];
    },
    getFirstByChapterId: (chapterId: string): Question | undefined => {
      return db
        .prepare('SELECT * FROM questions WHERE chapterId = ? ORDER BY "order" LIMIT 1')
        .get(chapterId) as Question | undefined;
    },
    create: (question: Omit<Question, 'id'>): Question => {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO questions (id, chapterId, question, answer, "order") VALUES (?, ?, ?, ?, ?)',
      ).run(id, question.chapterId, question.question, question.answer, question.order);
      return { id, ...question };
    },
    update: (
      id: string,
      question: Partial<Omit<Question, 'id'>>,
    ): Question | undefined => {
      const existing = db
        .prepare('SELECT * FROM questions WHERE id = ?')
        .get(id) as Question | undefined;
      if (!existing) return undefined;
      const updated = { ...existing, ...question };
      db.prepare(
        'UPDATE questions SET question = ?, answer = ?, "order" = ? WHERE id = ?',
      ).run(updated.question, updated.answer, updated.order, id);
      return updated;
    },
    delete: (id: string): boolean => {
      const result = db.prepare('DELETE FROM questions WHERE id = ?').run(id);
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
  const questionRepository = createQuestionRepository();

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: createContext({ lectureRepository, chapterRepository, questionRepository }),
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
