import { useTranslation } from 'react-i18next';

import { useEffect, useRef, useState } from 'react';

import type { Chapter } from '@athena/api';

import { trpc } from '../utils/trpc';
import { EditChapterModal, type EditingQuestion } from './EditChapterModal';

interface ChapterMenuProps {
  chapter: Chapter;
  lectureId: string;
}

export const ChapterMenu = ({ chapter, lectureId }: ChapterMenuProps) => {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Edit form state
  const [editingAssociation, setEditingAssociation] = useState(
    chapter.association,
  );
  const [editingQuestions, setEditingQuestions] = useState<EditingQuestion[]>(
    [],
  );

  // Fetch all questions for this chapter
  const chapterQuestionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: chapter.id },
    { enabled: editModalOpen },
  );

  // Fetch distinct associations for autocomplete
  const associationsQuery = trpc.chapters.getDistinctAssociations.useQuery();
  const existingAssociations = associationsQuery.data || [];

  // Sync fetched questions to editing state when modal opens
  useEffect(() => {
    if (editModalOpen && chapterQuestionsQuery.data !== undefined) {
      const questions = chapterQuestionsQuery.data;
      if (questions.length > 0) {
        setEditingQuestions(
          questions.map((q, index) => ({
            id: q.id,
            question: q.question,
            answer: q.answer,
            order: q.order,
            isExpanded: index === 0,
            showPreview: false,
          })),
        );
      } else {
        setEditingQuestions([
          {
            id: null,
            question: '',
            answer: '',
            order: 0,
            isExpanded: true,
            showPreview: false,
          },
        ]);
      }
    }
  }, [editModalOpen, chapterQuestionsQuery.data]);

  const updateChapter = trpc.chapters.updateChapter.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId });
    },
  });

  const updateQuestion = trpc.questions.updateQuestion.useMutation({
    onSuccess: () => {
      utils.questions.getFirstQuestion.invalidate({ chapterId: chapter.id });
      utils.questions.getQuestions.invalidate({ chapterId: chapter.id });
    },
  });

  const createQuestion = trpc.questions.createQuestion.useMutation({
    onSuccess: () => {
      utils.questions.getFirstQuestion.invalidate({ chapterId: chapter.id });
      utils.questions.getQuestions.invalidate({ chapterId: chapter.id });
    },
  });

  const deleteQuestion = trpc.questions.deleteQuestion.useMutation({
    onSuccess: () => {
      utils.questions.getFirstQuestion.invalidate({ chapterId: chapter.id });
      utils.questions.getQuestions.invalidate({ chapterId: chapter.id });
    },
  });

  const handleSaveEdit = async () => {
    const hasValidQuestion = editingQuestions.some((q) => q.question.trim());
    if (!hasValidQuestion) return;

    // Update chapter association if changed
    if (editingAssociation !== chapter.association) {
      updateChapter.mutate({
        id: chapter.id,
        association: editingAssociation,
      });
    }

    // Save all questions
    for (const eq of editingQuestions) {
      if (!eq.question.trim()) continue;

      if (eq.id) {
        updateQuestion.mutate({
          id: eq.id,
          question: eq.question.trim(),
          answer: eq.answer,
          order: eq.order,
        });
      } else {
        createQuestion.mutate({
          chapterId: chapter.id,
          question: eq.question.trim(),
          answer: eq.answer,
          order: eq.order,
        });
      }
    }

    handleCancelEdit();
  };

  const handleOpenEdit = () => {
    setEditingAssociation(chapter.association);
    setEditingQuestions([]);
    setMenuOpen(false);
    setEditModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditModalOpen(false);
    setEditingAssociation(chapter.association);
    setEditingQuestions([]);
  };

  const handleAddQuestion = () => {
    const maxOrder =
      editingQuestions.length > 0
        ? Math.max(...editingQuestions.map((q) => q.order))
        : -1;
    setEditingQuestions([
      ...editingQuestions.map((q) => ({ ...q, isExpanded: false })),
      {
        id: null,
        question: '',
        answer: '',
        order: maxOrder + 1,
        isExpanded: true,
        showPreview: false,
      },
    ]);
  };

  const handleUpdateEditingQuestion = (
    index: number,
    updates: Partial<EditingQuestion>,
  ) => {
    setEditingQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q)),
    );
  };

  const handleToggleQuestionExpanded = (index: number) => {
    setEditingQuestions((prev) =>
      prev.map((q, i) => ({
        ...q,
        isExpanded: i === index ? !q.isExpanded : false,
      })),
    );
  };

  const handleDeleteEditingQuestion = (index: number) => {
    const question = editingQuestions[index];
    if (question.id) {
      deleteQuestion.mutate({ id: question.id });
    }
    setEditingQuestions((prev) => prev.filter((_, i) => i !== index));
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
              {t('chapterMenu.editChapter')}
            </button>
          </div>
        )}
      </div>

      {/* Chapter Edit Modal */}
      {editModalOpen && (
        <EditChapterModal
          association={editingAssociation}
          questions={editingQuestions}
          isSaving={updateQuestion.isLoading || createQuestion.isLoading}
          existingAssociations={existingAssociations}
          onAssociationChange={setEditingAssociation}
          onAddQuestion={handleAddQuestion}
          onUpdateQuestion={handleUpdateEditingQuestion}
          onToggleQuestionExpanded={handleToggleQuestionExpanded}
          onDeleteQuestion={handleDeleteEditingQuestion}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}
    </>
  );
};

