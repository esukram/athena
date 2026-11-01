import { describe, expect, it, vi } from 'vitest';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { Question } from '@athena/api';

import { useChapterEditor } from '../hooks/useChapterEditor';
import { createTrpcTestWrapper, deferred } from '../test/trpcTestLink';
import { EditChapterModal } from './EditChapterModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('EditChapterModal', () => {
  it('keeps the question row and focus when auto-save assigns its id', async () => {
    const created = deferred<Question>();
    const onAutoSaved = vi.fn();
    const createQuestion = vi.fn(() => created.promise);
    const { Wrapper } = createTrpcTestWrapper({
      chapters: {
        createChapter: () => ({
          id: 'chapter-1',
          lectureId: 'lecture-1',
          association: '',
          order: 0,
        }),
      },
      questions: { createQuestion },
    });
    function Editor() {
      const { edit, openNew } = useChapterEditor({
        lectureId: 'lecture-1',
        onAutoSaved,
      });
      return (
        <>
          <button onClick={() => openNew(0, 'What is 2 + 2?')}>Open</button>
          {edit && <EditChapterModal edit={edit} />}
        </>
      );
    }
    render(<Editor />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByText('editChapterModal.addQuestion'));
    await waitFor(() => expect(createQuestion).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('What is 2 + 2?'));
    const input = screen.getByDisplayValue('What is 2 + 2?');
    input.focus();

    await act(async () =>
      created.resolve({
        id: 'question-1',
        chapterId: 'chapter-1',
        question: 'What is 2 + 2?',
        answer: '',
        order: 0,
        isAnnotated: false,
      }),
    );
    await waitFor(() => expect(onAutoSaved).toHaveBeenCalledTimes(1));

    expect(screen.getByDisplayValue('What is 2 + 2?')).toBe(input);
    expect(input).toHaveFocus();
  });
});
