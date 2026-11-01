import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { EditChapterModal, type EditingQuestion } from './EditChapterModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('EditChapterModal', () => {
  it('keeps the question row mounted when saving assigns its id', () => {
    const unsaved: EditingQuestion = {
      id: null,
      clientKey: 'client-1',
      question: 'What is 2 + 2?',
      answer: '',
      order: 0,
      isExpanded: true,
      showPreview: false,
    };
    const renderModal = (questions: EditingQuestion[]) => (
      <EditChapterModal
        association=""
        questions={questions}
        isSaving={false}
        initialAssociation=""
        initialQuestions={questions}
        onAssociationChange={vi.fn()}
        onAddQuestion={vi.fn()}
        onUpdateQuestion={vi.fn()}
        onToggleQuestionExpanded={vi.fn()}
        onDeleteQuestion={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const { rerender } = render(renderModal([unsaved]));
    const input = screen.getByDisplayValue('What is 2 + 2?');
    input.focus();

    rerender(renderModal([{ ...unsaved, id: 'question-1' }]));

    expect(screen.getByDisplayValue('What is 2 + 2?')).toBe(input);
    expect(input).toHaveFocus();
  });
});
