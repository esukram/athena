import { useNavigate } from 'react-router-dom';

import type { Lecture } from '@athena/api';

import { LectureMenu } from './LectureMenu';

export const LectureCard = ({ lecture }: { lecture: Lecture }) => {
  const navigate = useNavigate();

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-gray-100">
      <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-50">
        <LectureMenu lecture={lecture} />

        <div className="h-full w-full flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-700 mb-2 text-center">
              {lecture.title}
            </h2>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      <div className="flex flex-col flex-1 p-6">
        <div className="flex-1 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
            {lecture.description}
          </p>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => navigate(`/lecture/${lecture.id}`)}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 active:bg-primary-200 transition-all duration-200 hover:shadow-md"
          >
            Learn
          </button>

          <button
            onClick={() => navigate(`/lecture/${lecture.id}/train`)}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Train
          </button>
        </div>
      </div>
    </div>
  );
};
