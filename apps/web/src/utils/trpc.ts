import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@athena/api';

export const trpc = createTRPCReact<AppRouter>();
