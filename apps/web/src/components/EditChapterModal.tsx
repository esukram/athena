import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

import { useEffect, useRef, useState } from 'react';

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on current input
  const filteredSuggestions = existingAssociations.filter(
    (a) =>
      a.toLowerCase().includes(association.toLowerCase()) && a !== association,
  );

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
                          placeholder={t('editChapterModal.questionPlaceholder')}
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
                            rows={8}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                            placeholder={t('editChapterModal.answerPlaceholder')}
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
            className="px-4 py-2 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !canSave}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? t('common.loading') : t('editChapterModal.saveChapter')}
          </button>
        </div>
      </div>
    </div>
  );
};

