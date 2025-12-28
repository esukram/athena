import { useNavigate } from 'react-router-dom';

import { useEffect, useRef, useState } from 'react';

import type { Lecture } from '@athena/api';

import { trpc } from '../utils/trpc';

export const LectureCard = ({ lecture }: { lecture: Lecture }) => {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const deleteLecture = trpc.lectures.deleteLecture.useMutation({
    onSuccess: () => {
      utils.lectures.getLectures.invalidate();
    },
  });

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${lecture.title}"?`)) {
      setMenuOpen(false);
      deleteLecture.mutate({ id: lecture.id });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-gray-100">
      <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-50">
        {/* 3-dots menu */}
        <div className="absolute top-3 right-3 z-10" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="opacity-0 group-hover:opacity-100 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-all duration-200"
            aria-label="More options"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-700"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  navigate(`/edit-lecture/${lecture.id}`);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Edit Lecture
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete Lecture
              </button>
            </div>
          )}
        </div>

        <div className="h-full w-full flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-700 mb-2">
              {lecture.title}
            </h2>
            <p className="text-sm text-primary-600 font-medium">
              {lecture.subtitle}
            </p>
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
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg hover:from-primary-700 hover:to-primary-800 active:from-primary-800 active:to-primary-900 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
};
