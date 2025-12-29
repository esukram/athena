import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { Lecture } from '@athena/api';
import { trpc } from '../utils/trpc';

interface LectureMenuProps {
  lecture: Lecture;
}

export const LectureMenu = ({ lecture }: LectureMenuProps) => {
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
    <div className="absolute top-3 right-3 z-10" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-all duration-200"
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
              navigate(`/lecture/${lecture.id}/edit`);
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
  );
};
