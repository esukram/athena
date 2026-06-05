import { expect, test } from '@playwright/test';

// Regression test for the sidebar focus-ring bug: selecting a chapter with the
// mouse leaves DOM focus on its button; navigating questions with the keyboard
// (handled by a global window listener) changes the active chapter via the URL
// without moving focus, so the previously-selected entry kept its
// :focus-visible outline — a purple border stuck on the wrong chapter.
test.describe('Lecture Train - sidebar focus ring', () => {
  test('focus outline does not linger on the previous chapter', async ({
    page,
  }) => {
    const lectureId = 'lecture-focus-1';
    const lecture = { id: lectureId, title: 'Focus', description: 'd' };
    const chapters = [
      { id: 'c1', lectureId, order: 0 },
      { id: 'c2', lectureId, order: 1 },
    ];
    const firstQuestions = {
      c1: { question: 'Q1 Chapter 1' },
      c2: { question: 'Q1 Chapter 2' },
    };
    const questionsByChapter: Record<string, unknown[]> = {
      c1: [
        {
          id: 'c1q1',
          chapterId: 'c1',
          question: 'Q1 Chapter 1',
          answer: 'A1',
          order: 0,
          isAnnotated: false,
        },
      ],
      c2: [
        {
          id: 'c2q1',
          chapterId: 'c2',
          question: 'Q1 Chapter 2',
          answer: 'A2',
          order: 0,
          isAnnotated: false,
        },
      ],
    };

    await page.route('**/api/trpc/lectures.getLecture?*', async (r) =>
      r.fulfill({ json: { result: { data: lecture } } }),
    );
    await page.route('**/api/trpc/chapters.getChapters*', async (r) =>
      r.fulfill({ json: { result: { data: chapters } } }),
    );
    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (r) => r.fulfill({ json: { result: { data: firstQuestions } } }),
    );
    await page.route(
      '**/api/trpc/questions.getAnnotatedChapterIdsByLecture*',
      async (r) => r.fulfill({ json: { result: { data: [] } } }),
    );
    await page.route(
      '**/api/trpc/questions.getQuestionCountsByLecture*',
      async (r) => r.fulfill({ json: { result: { data: 2 } } }),
    );
    await page.route(
      '**/api/trpc/questions.getQuestionCountsPerChapter*',
      async (r) =>
        r.fulfill({ json: { result: { data: { c1: 1, c2: 1 } } } }),
    );
    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      const url = new URL(route.request().url());
      const input = JSON.parse(
        decodeURIComponent(url.searchParams.get('input') || '{}'),
      );
      const chapterId = input?.['0']?.chapterId ?? input?.chapterId;
      await route.fulfill({
        json: { result: { data: questionsByChapter[chapterId] ?? [] } },
      });
    });

    await page.goto(`/#/train/${lectureId}`);

    const c1 = page.getByRole('button', { name: '1. Q1 Chapter 1' });
    const c2 = page.getByRole('button', { name: '2. Q1 Chapter 2' });

    // Select chapter 2 with the mouse, then navigate with the keyboard back
    // into chapter 1 (chapter 2 has a single question, so ArrowLeft crosses the
    // boundary).
    await c2.click();
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c2`));
    // Wait for chapter 2's card to render so the global key handler is wired to
    // the current chapter before we navigate with the keyboard.
    await expect(page.getByText('Q1 Chapter 2', { exact: true })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c1`));

    // Chapter 1 is now the active chapter.
    await expect(c1).toHaveClass(/bg-primary-100/);

    // The previously-selected chapter 2 must not keep a focus outline.
    await expect(c2).not.toBeFocused();
    expect(await c2.evaluate((el) => el.matches(':focus-visible'))).toBe(false);
  });
});
