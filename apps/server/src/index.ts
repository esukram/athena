import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter, createContext } from '@athena/api';

const server = Fastify({
  logger: true,
});

async function main() {
  await server.register(cors, {
    origin: true, // Allow all origins for dev simplicity
  });

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext },
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
