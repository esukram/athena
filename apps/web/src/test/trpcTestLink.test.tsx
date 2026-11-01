import { describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@testing-library/react';
import { TRPCClientError, createTRPCClient } from '@trpc/client';

import type { AppRouter, Lecture } from '@athena/api';

import { trpc } from '../utils/trpc';
import { createTrpcTestWrapper, deferred, inMemoryLink } from './trpcTestLink';

const lecture: Lecture = {
  id: 'l1',
  title: 'Alpha',
  description: '',
  order: 0,
};

describe('in-memory tRPC test link', () => {
  it('answers a query from its handler with the given input', async () => {
    const getLecture = vi.fn(() => lecture);
    const { Wrapper } = createTrpcTestWrapper({ lectures: { getLecture } });

    const { result } = renderHook(
      () => trpc.lectures.getLecture.useQuery({ id: 'l1' }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(lecture));
    expect(getLecture).toHaveBeenCalledWith({ id: 'l1' });
  });

  it('holds the response until the test releases it', async () => {
    const pending = deferred<Lecture>();
    const { Wrapper } = createTrpcTestWrapper({
      lectures: { getLecture: () => pending.promise },
    });

    const { result } = renderHook(
      () => trpc.lectures.getLecture.useQuery({ id: 'l1' }),
      { wrapper: Wrapper },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.isPending).toBe(true);

    pending.resolve(lecture);
    await waitFor(() => expect(result.current.data).toEqual(lecture));
  });

  it('reports a thrown handler error as a query error', async () => {
    const { Wrapper } = createTrpcTestWrapper({
      lectures: {
        getLecture: () => {
          throw new Error('boom');
        },
      },
    });

    const { result } = renderHook(
      () => trpc.lectures.getLecture.useQuery({ id: 'l1' }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('boom');
  });

  it('fails a procedure that has no handler', async () => {
    const { Wrapper } = createTrpcTestWrapper({});

    const { result } = renderHook(
      () => trpc.lectures.getLecture.useQuery({ id: 'l1' }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      'No test handler for lectures.getLecture',
    );
  });

  it('runs mutations and refetches invalidated queries', async () => {
    let title = 'Alpha';
    const getLecture = vi.fn(() => ({ ...lecture, title }));
    const { Wrapper } = createTrpcTestWrapper({
      lectures: {
        getLecture,
        updateLecture: (input) => {
          title = input.title ?? title;
          return { ...lecture, title };
        },
      },
    });

    const { result } = renderHook(
      () => ({
        query: trpc.lectures.getLecture.useQuery({ id: 'l1' }),
        update: trpc.lectures.updateLecture.useMutation(),
        utils: trpc.useUtils(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.query.data?.title).toBe('Alpha'));

    await act(async () => {
      await result.current.update.mutateAsync({ id: 'l1', title: 'Beta' });
      await result.current.utils.lectures.getLecture.invalidate({ id: 'l1' });
    });

    await waitFor(() => expect(result.current.query.data?.title).toBe('Beta'));
    expect(getLecture).toHaveBeenCalledTimes(2);
  });

  it('fails an aborted request and never delivers its response', async () => {
    const pending = deferred<Lecture>();
    const getLecture = vi.fn(() => pending.promise);
    const client = createTRPCClient<AppRouter>({
      links: [inMemoryLink({ lectures: { getLecture } })],
    });

    const controller = new AbortController();
    const request = client.lectures.getLecture.query(
      { id: 'l1' },
      { signal: controller.signal },
    );
    controller.abort();
    pending.resolve(lecture);

    await expect(request).rejects.toBeInstanceOf(TRPCClientError);

    // Already aborted: the handler is never asked.
    getLecture.mockClear();
    await expect(
      client.lectures.getLecture.query(
        { id: 'l1' },
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(TRPCClientError);
    expect(getLecture).not.toHaveBeenCalled();
  });
});
