import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChapterEdit } from '../hooks/useChapterEditor';

interface EditChapterModalProps {
  edit: ChapterEdit;
  existingAssociations?: string[];
}

export const EditChapterModal = ({
  edit,
  existingAssociations = [],
}: EditChapterModalProps) => {
  const { t } = useTranslation();
  const { draft, canSave, isDirty, isSaving, saveFailed } = edit;
  const association = draft.tag;
  const questions = draft.questions;
  const onAssociationChange = edit.setTag;
  const onCancel = edit.close;

  // Accordion: at most one Question expanded, the first one on open.
  const [expandedKey, setExpandedKey] = useState<string | null>(
    questions[0]?.key ?? null,
  );
  const [previewKeys, setPreviewKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const togglePreview = (key: string) =>
    setPreviewKeys((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const handleAddQuestion = () => {
    const key = edit.addQuestion();
    if (key) setExpandedKey(key);
  };

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
    void edit.save();
  }, [association, edit]);

  const handleAnswerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    key: string,
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

      edit.updateQuestion(key, { answer: newValue });

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
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-xl shadow-sm w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border">
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
              className="w-full px-4 py-2 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder={t('editChapterModal.associationPlaceholder')}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-sm max-h-48 overflow-y-auto"
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
                onClick={handleAddQuestion}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                {t('editChapterModal.addQuestion')}
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((eq, index) => {
                const isExpanded = eq.key === expandedKey;
                const showPreview = previewKeys.has(eq.key);
                return (
                  <div
                    key={eq.key}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    {/* Accordion Header */}
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isExpanded ? null : eq.key)}
                      className="w-full flex items-center justify-between p-4 bg-bg-tint hover:bg-surface-2 transition-colors text-left"
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
                              edit.deleteQuestion(eq.key);
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title={t('editChapterModal.deleteQuestion')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {isExpanded ? (
                          <ChevronUp size={20} className="text-ink-faint" />
                        ) : (
                          <ChevronDown size={20} className="text-ink-faint" />
                        )}
                      </div>
                    </button>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 border-t border-border">
                        <div>
                          <label className="block text-sm font-medium text-on-surface mb-2">
                            {t('editChapterModal.question')}
                          </label>
                          <input
                            type="text"
                            value={eq.question}
                            onChange={(e) =>
                              edit.updateQuestion(eq.key, {
                                question: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
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
                              onClick={() => togglePreview(eq.key)}
                              className="text-sm text-primary-600 hover:text-primary-700"
                            >
                              {showPreview
                                ? t('common.edit')
                                : t('editChapterModal.preview')}
                            </button>
                          </div>

                          {showPreview ? (
                            <div className="w-full min-h-[200px] px-4 py-3 rounded-lg border border-border bg-surface prose prose-sm dark:prose-invert max-w-none overflow-y-auto">
                              {eq.answer ? (
                                <ReactMarkdown>{eq.answer}</ReactMarkdown>
                              ) : (
                                <p className="text-ink-faint italic">
                                  {t('editChapterModal.noContentYet')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <textarea
                              value={eq.answer}
                              onChange={(e) =>
                                edit.updateQuestion(eq.key, {
                                  answer: e.target.value,
                                })
                              }
                              onKeyDown={(e) =>
                                handleAnswerKeyDown(e, eq.key, eq.answer)
                              }
                              rows={8}
                              className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                              placeholder={t(
                                'editChapterModal.answerPlaceholder',
                              )}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border flex flex-wrap items-center gap-3 justify-end">
          {saveFailed && (
            <p role="alert" className="mr-auto text-sm text-error">
              {t('editChapterModal.saveFailed')}
            </p>
          )}
          <button
            onClick={onCancel}
            title={`${t('common.cancel')} (Esc)`}
            className="min-w-[7rem] px-4 py-2 rounded-lg bg-surface border border-border text-on-surface hover:bg-bg-tint transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            title={`${t('common.save')} (Ctrl+Enter)`}
            className="min-w-[7rem] px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-on-primary font-medium rounded-lg transition-colors"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
