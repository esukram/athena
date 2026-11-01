import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCClientError, type TRPCLink } from '@trpc/client';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { observable } from '@trpc/server/observable';

import type { AppRouter } from '@athena/api';

import { trpc } from '../utils/trpc';

type Inputs = inferRouterInputs<AppRouter>;
type Outputs = inferRouterOutputs<AppRouter>;

/**
 * Test doubles for tRPC procedures, keyed like the router
 * (`{ questions: { getQuestions: (input) => [...] } }`). A handler may return
 * a value or a promise, so a test controls both the data and when it arrives;
 * a thrown error or rejected promise becomes a `TRPCClientError`.
 */
export type TrpcTestHandlers = {
  [R in keyof Inputs]?: {
    [P in keyof Inputs[R]]?: (
      input: Inputs[R][P],
    ) => Outputs[R][P] | Promise<Outputs[R][P]>;
  };
};

type AnyHandler = (input: unknown) => unknown;

/**
 * A terminating link that answers every operation from `handlers` instead of
 * the network. Use it in place of `httpLink`; a procedure without a handler
 * fails loudly so a test never silently waits on an unanswered request.
 */
export function inMemoryLink(handlers: TrpcTestHandlers): TRPCLink<AppRouter> {
  const byPath = handlers as Record<
    string,
    Record<string, AnyHandler | undefined> | undefined
  >;
  return () =>
    ({ op }) =>
      observable((observer) => {
        // Settled by a response, a failure, an abort or an unsubscribe;
        // whichever comes first wins, like a real request.
        let settled = false;
        const fail = (cause: unknown) => {
          if (settled) return;
          settled = true;
          observer.error(
            TRPCClientError.from(
              cause instanceof Error ? cause : new Error(String(cause)),
            ),
          );
        };
        // Like `httpLink`, a cancelled request fails and never delivers.
        const { signal } = op;
        const onAbort = () => fail(signal?.reason ?? new Error('Aborted'));
        if (signal?.aborted) {
          onAbort();
          return () => {};
        }
        signal?.addEventListener('abort', onAbort);

        const [routerKey, procedureKey] = op.path.split('.');
        const handler = byPath[routerKey]?.[procedureKey];

        Promise.resolve()
          .then(() => {
            if (!handler) throw new Error(`No test handler for ${op.path}`);
            return handler(op.input);
          })
          .then((data) => {
            if (settled) return;
            settled = true;
            // Mirror the JSON wire format (no transformer), so tests get the
            // same shapes as production and never share fixture objects with
            // the query cache.
            observer.next({
              result: {
                type: 'data',
                data:
                  data === undefined
                    ? undefined
                    : JSON.parse(JSON.stringify(data)),
              },
            });
            observer.complete();
          }, fail);

        return () => {
          settled = true;
          signal?.removeEventListener('abort', onAbort);
        };
      });
}

/**
 * A real tRPC React client and a real `QueryClient`, wired to
 * {@link inMemoryLink}. Pass `Wrapper` to `render`/`renderHook`; keep
 * `queryClient` to inspect or seed the cache.
 */
export function createTrpcTestWrapper(handlers: TrpcTestHandlers) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Fail fast: a retried error would hide behind back-off timers.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const trpcClient = trpc.createClient({ links: [inMemoryLink(handlers)] });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );

  return { Wrapper, queryClient };
}

/** A promise plus its settle functions, for holding a response mid-flight. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
