import ReactMarkdown from 'react-markdown';
import { Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

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
  onAssociationChange,
  onAddQuestion,
  onUpdateQuestion,
  onToggleQuestionExpanded,
  onDeleteQuestion,
  onSave,
  onCancel,
}: EditChapterModalProps) => {
  const canSave = questions.some(q => q.question.trim());

  return (
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
              Association
            </label>
            <input
              type="text"
              value={association}
              onChange={(e) => onAssociationChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Enter association"
            />
          </div>

          {/* Questions Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-on-surface">
                Questions
              </label>
              <button
                type="button"
                onClick={onAddQuestion}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Question
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
                        {eq.question || 'New Question'}
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
                          title="Delete question"
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
                          Question
                        </label>
                        <input
                          type="text"
                          value={eq.question}
                          onChange={(e) =>
                            onUpdateQuestion(index, { question: e.target.value })
                          }
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          placeholder="Enter question"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-on-surface">
                            Answer (Markdown)
                          </label>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() =>
                              onUpdateQuestion(index, { showPreview: !eq.showPreview })
                            }
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            {eq.showPreview ? 'Edit' : 'Preview'}
                          </button>
                        </div>

                        {eq.showPreview ? (
                          <div className="w-full min-h-[200px] px-4 py-3 rounded-lg border border-gray-300 bg-white prose prose-sm max-w-none overflow-y-auto">
                            {eq.answer ? (
                              <ReactMarkdown>{eq.answer}</ReactMarkdown>
                            ) : (
                              <p className="text-gray-400 italic">No content yet</p>
                            )}
                          </div>
                        ) : (
                          <textarea
                            value={eq.answer}
                            onChange={(e) =>
                              onUpdateQuestion(index, { answer: e.target.value })
                            }
                            rows={8}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                            placeholder="Write your answer in Markdown..."
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
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !canSave}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Chapter'}
          </button>
        </div>
      </div>
    </div>
  );
};
