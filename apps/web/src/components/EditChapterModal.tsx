import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface EditingQuestion {
  id: string | null;
  question: string;
  answer: string;
  order: number;
  isExpanded: boolean;
  showPreview: boolean;
}

interface EditChapterModalProps {
  association: string;
  questions: EditingQuestion[];
  isSaving: boolean;
  existingAssociations?: string[];
  initialAssociation: string;
  initialQuestions: EditingQuestion[];
  onAssociationChange: (association: string) => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (index: number, updates: Partial<EditingQuestion>) => void;
  onToggleQuestionExpanded: (index: number) => void;
  onDeleteQuestion: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const EditChapterModal = ({
  association,
  questions,
  isSaving,
  existingAssociations = [],
  initialAssociation,
  initialQuestions,
  onAssociationChange,
  onAddQuestion,
  onUpdateQuestion,
  onToggleQuestionExpanded,
  onDeleteQuestion,
  onSave,
  onCancel,
}: EditChapterModalProps) => {
  const { t } = useTranslation();
  const canSave = questions.some((q) => q.question.trim());

  // Compute dirty state by comparing current values against initial values
  const isDirty = (() => {
    // Check if association changed
    if (association !== initialAssociation) return true;
    // Check if questions count changed
    if (questions.length !== initialQuestions.length) return true;
    // Check if any question content changed
    for (let i = 0; i < questions.length; i++) {
      const current = questions[i];
      const initial = initialQuestions[i];
      if (!initial) return true;
      if (current.question !== initial.question) return true;
      if (current.answer !== initial.answer) return true;
    }
    return false;
  })();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [lastUsedAssociation, setLastUsedAssociation] = useState<string | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load last used association from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('lastUsedAssociation');
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastUsedAssociation(saved);
    }
  }, []);

  // Filter and sort suggestions based on current input
  const filteredSuggestions = existingAssociations
    .filter(
      (a) =>
        a.toLowerCase().includes(association.toLowerCase()) &&
        a !== association,
    )
    .sort((a, b) => {
      // Place last used association at the top
      if (lastUsedAssociation) {
        if (a === lastUsedAssociation) return -1;
        if (b === lastUsedAssociation) return 1;
      }
      return 0;
    });

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSuggestions.length - 1,
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      onAssociationChange(filteredSuggestions[highlightedIndex]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onAssociationChange(suggestion);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleSave = useCallback(() => {
    // Save the association to localStorage for future use
    if (association.trim()) {
      localStorage.setItem('lastUsedAssociation', association.trim());
      setLastUsedAssociation(association.trim());
    }
    onSave();
  }, [association, onSave]);

  const handleAnswerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number,
    currentAnswer: string,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = currentAnswer || '';
      const newValue =
        value.substring(0, start) + '\n\n' + value.substring(end);

      onUpdateQuestion(index, { answer: newValue });

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if the event was already handled (e.g. by input suggestion selection)
      if (e.defaultPrevented) return;

      if (e.key === 'Escape') {
        if (showSuggestions) {
          setShowSuggestions(false);
          setHighlightedIndex(-1);
        } else if (isDirty) {
          if (confirm(t('editChapterModal.confirmDiscardChanges'))) {
            onCancel();
          }
        } else {
          onCancel();
        }
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (canSave && !isSaving) {
          e.preventDefault();
          handleSave();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showSuggestions, canSave, isSaving, onCancel, handleSave, isDirty, t]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-on-surface">
            {t('editChapterModal.editChapter')}
          </h3>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="relative">
            <label className="block text-sm font-medium text-on-surface mb-2">
              {t('editChapterModal.association')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={association}
              onChange={(e) => {
                onAssociationChange(e.target.value);
                setShowSuggestions(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder={t('editChapterModal.associationPlaceholder')}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`w-full px-4 py-2 text-left hover:bg-primary-50 transition-colors ${
                      index === highlightedIndex ? 'bg-primary-100' : ''
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Questions Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-on-surface">
                {t('editChapterModal.questions')}
              </label>
              <button
                type="button"
                onClick={onAddQuestion}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                {t('editChapterModal.addQuestion')}
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((eq, index) => (
                <div
                  key={eq.id || `new-${index}`}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Accordion Header */}
                  <button
                    type="button"
                    onClick={() => onToggleQuestionExpanded(index)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-700 font-semibold rounded-full text-xs">
                        {index + 1}
                      </span>
                      <span className="text-on-surface font-medium truncate">
                        {eq.question || t('editChapterModal.newQuestion')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteQuestion(index);
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                          title={t('editChapterModal.deleteQuestion')}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {eq.isExpanded ? (
                        <ChevronUp size={20} className="text-gray-500" />
                      ) : (
                        <ChevronDown size={20} className="text-gray-500" />
                      )}
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {eq.isExpanded && (
                    <div className="p-4 space-y-4 border-t border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-on-surface mb-2">
                          {t('editChapterModal.question')}
                        </label>
                        <input
                          type="text"
                          value={eq.question}
                          onChange={(e) =>
                            onUpdateQuestion(index, {
                              question: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          placeholder={t(
                            'editChapterModal.questionPlaceholder',
                          )}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-on-surface">
                            {t('editChapterModal.answerMarkdown')}
                          </label>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() =>
                              onUpdateQuestion(index, {
                                showPreview: !eq.showPreview,
                              })
                            }
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            {eq.showPreview
                              ? t('common.edit')
                              : t('editChapterModal.preview')}
                          </button>
                        </div>

                        {eq.showPreview ? (
                          <div className="w-full min-h-[200px] px-4 py-3 rounded-lg border border-gray-300 bg-white prose prose-sm max-w-none overflow-y-auto">
                            {eq.answer ? (
                              <ReactMarkdown>{eq.answer}</ReactMarkdown>
                            ) : (
                              <p className="text-gray-400 italic">
                                {t('editChapterModal.noContentYet')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <textarea
                            value={eq.answer}
                            onChange={(e) =>
                              onUpdateQuestion(index, {
                                answer: e.target.value,
                              })
                            }
                            onKeyDown={(e) =>
                              handleAnswerKeyDown(e, index, eq.answer)
                            }
                            rows={8}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                            placeholder={t(
                              'editChapterModal.answerPlaceholder',
                            )}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            title={`${t('common.cancel')} (Esc)`}
            className="min-w-[7rem] px-4 py-2 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            title={`${t('common.save')} (Ctrl+Enter)`}
            className="min-w-[7rem] px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
