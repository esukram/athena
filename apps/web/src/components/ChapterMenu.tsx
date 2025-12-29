import ReactMarkdown from 'react-markdown';
import { useEffect, useRef, useState } from 'react';
import type { Chapter } from '@athena/api';
import { trpc } from '../utils/trpc';

interface ChapterMenuProps {
  chapter: Chapter;
  lectureId: string;
}

export const ChapterMenu = ({ chapter, lectureId }: ChapterMenuProps) => {
  const utils = trpc.useUtils();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Edit form state
  const [editingTitle, setEditingTitle] = useState(chapter.title);
  const [editingBody, setEditingBody] = useState(chapter.body);
  const [editingAssociation, setEditingAssociation] = useState(chapter.association);
  const [showPreview, setShowPreview] = useState(false);

  const updateChapter = trpc.chapters.updateChapter.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId });
      setEditModalOpen(false);
      setShowPreview(false);
    },
  });

  const handleSaveEdit = () => {
    if (!editingTitle.trim()) return;
    updateChapter.mutate({
      id: chapter.id,
      title: editingTitle.trim(),
      body: editingBody,
      association: editingAssociation,
    });
  };

  const handleOpenEdit = () => {
    setEditingTitle(chapter.title);
    setEditingBody(chapter.body);
    setEditingAssociation(chapter.association);
    setShowPreview(false);
    setMenuOpen(false);
    setEditModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditModalOpen(false);
    setEditingTitle(chapter.title);
    setEditingBody(chapter.body);
    setEditingAssociation(chapter.association);
    setShowPreview(false);
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

  // Prevent keyboard navigation when modal is open
  useEffect(() => {
    if (editModalOpen) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.stopPropagation();
        }
      };
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [editModalOpen]);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
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
                handleOpenEdit();
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Edit Chapter
            </button>
          </div>
        )}
      </div>

      {/* Chapter Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-on-surface">
                Edit Chapter
              </h3>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-2">
                  Chapter Title
                </label>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="Chapter title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-2">
                  Association
                </label>
                <input
                  type="text"
                  value={editingAssociation}
                  onChange={(e) => setEditingAssociation(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="Enter association"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-on-surface">
                    Content (Markdown)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    {showPreview ? 'Edit' : 'Preview'}
                  </button>
                </div>

                {showPreview ? (
                  <div className="w-full min-h-[300px] px-4 py-3 rounded-lg border border-gray-300 bg-white prose prose-sm max-w-none overflow-y-auto">
                    {editingBody ? (
                      <ReactMarkdown>{editingBody}</ReactMarkdown>
                    ) : (
                      <p className="text-gray-400 italic">No content yet</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                    placeholder="Write your chapter content in Markdown..."
                  />
                )}
              </div>

              {updateChapter.error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 border border-red-200">
                  <p className="text-sm text-error">
                    Error: {updateChapter.error.message}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateChapter.isLoading || !editingTitle.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
              >
                {updateChapter.isLoading ? 'Saving...' : 'Save Chapter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
