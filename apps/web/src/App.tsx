import { HashRouter, Route, Routes } from 'react-router-dom';

import { useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';

import { AddLecture } from './pages/LectureAdd';
import { EditLecture } from './pages/LectureEdit';
import { LectureLearn } from './pages/LectureLearn';
import { LectureTrain } from './pages/LectureTrain';
import { LectureTrainRandomized } from './pages/LectureTrainRandomized';
import { Overview } from './pages/Overview';
import { trpc } from './utils/trpc';

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpLink({
          url: 'api/trpc',
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/add-lecture" element={<AddLecture />} />
            <Route path="/edit/:id" element={<EditLecture />} />
            <Route
              path="/train/:id/:chapterId?/:questionId?"
              element={<LectureTrain />}
            />
            <Route
              path="/train-random/:id/:chapterId?/:questionId?"
              element={<LectureTrainRandomized />}
            />
            <Route path="/learn/:id/:chapterId?" element={<LectureLearn />} />
          </Routes>
        </HashRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
