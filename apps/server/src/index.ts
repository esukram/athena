import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';

import './env.js';

import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';

import { appRouter, createContext } from '@athena/api';

import { createDatabase } from './db.js';
import { runMigrations } from './migration.js';
import {
  createChapterSearchQuery,
  createLectureOverviewQuery,
  createQuestionStatsQuery,
} from './queries.js';
import {
  createChapterRepository,
  createLectureRepository,
  createQuestionRepository,
} from './repositories.js';
import { createConfiguredSpeechService } from './tts-provider.js';
import { createUnitOfWork } from './unit-of-work.js';

const server = Fastify({
  logger: true,
});

async function main() {
  await server.register(cors, {
    origin: true, // Allow all origins for dev simplicity
  });

  // Open the database and run migrations
  const db = createDatabase();
  runMigrations(db);

  const lectureRepository = createLectureRepository(db);
  const chapterRepository = createChapterRepository(db);
  const questionRepository = createQuestionRepository(db);
  const lectureOverviewQuery = createLectureOverviewQuery(db);
  const chapterSearchQuery = createChapterSearchQuery(db);
  const questionStatsQuery = createQuestionStatsQuery(db);
  const unitOfWork = createUnitOfWork(db);
  const speechService = createConfiguredSpeechService();

  await server.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: createContext({
        lectureRepository,
        chapterRepository,
        questionRepository,
        lectureOverviewQuery,
        chapterSearchQuery,
        questionStatsQuery,
        unitOfWork,
        speechService,
      }),
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
    if (req.raw.url?.startsWith('/api')) {
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
