import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';

import { AddLecture } from './components/AddLecture';
import { EditLecture } from './components/EditLecture';
import { LectureView } from './components/LectureView';
import { Overview } from './components/Overview';
import { trpc } from './utils/trpc';

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/add-lecture" element={<AddLecture />} />
            <Route path="/edit-lecture/:id" element={<EditLecture />} />
            <Route path="/lecture/:id" element={<LectureView />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
