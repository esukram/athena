import { expect, test } from '@playwright/test';

test.describe('Move Chapter', () => {
  test('move a chapter from one lecture to another', async ({ page }) => {
    // Set up mock data
    const lectures = [
      { id: 'lecture-1', title: 'Lecture One', description: 'First lecture' },
      { id: 'lecture-2', title: 'Lecture Two', description: 'Second lecture' },
    ];

    const lectureOneChapters = [
      { id: 'chapter-1', lectureId: 'lecture-1', association: '', order: 0 },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lectureTwoChapters: any[] = [];

    const firstQuestions = {
      'chapter-1': {
        id: 'q-1',
        chapterId: 'chapter-1',
        question: 'Test Question',
        answer: 'Test Answer',
        order: 0,
        isAnnotated: false,
      },
    };

    // Mock getLectures - MUST come before getLecture to avoid route conflicts
    await page.route('**/api/trpc/lectures.getLectures*', async (route) => {
      await route.fulfill({
        json: { result: { data: lectures } },
      });
    });

    // Mock getLecture for individual lecture queries
    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      const url = route.request().url();
      if (url.includes('lecture-1')) {
        await route.fulfill({
          json: { result: { data: lectures[0] } },
        });
      } else if (url.includes('lecture-2')) {
        await route.fulfill({
          json: { result: { data: lectures[1] } },
        });
      } else {
        await route.fulfill({
          json: { result: { data: null } },
        });
      }
    });

    // Mock getChapters
    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      const url = route.request().url();
      if (url.includes('lecture-1')) {
        await route.fulfill({
          json: { result: { data: lectureOneChapters } },
        });
      } else if (url.includes('lecture-2')) {
        await route.fulfill({
          json: { result: { data: lectureTwoChapters } },
        });
      }
    });

    // Mock getFirstQuestionsByLecture
    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        const url = route.request().url();
        if (url.includes('lecture-1')) {
          await route.fulfill({
            json: { result: { data: firstQuestions } },
          });
        } else {
          await route.fulfill({
            json: { result: { data: {} } },
          });
        }
      },
    );

    // Mock getDistinctAssociations
    await page.route(
      '**/api/trpc/chapters.getDistinctAssociations*',
      async (route) => {
        await route.fulfill({
          json: { result: { data: [] } },
        });
      },
    );

    // Mock moveChapter
    await page.route('**/api/trpc/chapters.moveChapter*', async (route) => {
      // Simulate moving the chapter
      const chapter = lectureOneChapters.shift();
      if (chapter) {
        chapter.lectureId = 'lecture-2';
        chapter.order = lectureTwoChapters.length;
        lectureTwoChapters.push(chapter);
      }

      await route.fulfill({
        json: { result: { data: chapter } },
      });
    });

    // Navigate to the edit page for lecture-1
    await page.goto('/#/edit/lecture-1');

    // Wait for the page to load
    await expect(page.getByText('Test Question')).toBeVisible();

    // Click the Move button
    await page.getByRole('button', { name: 'Move', exact: true }).click();

    // The move modal should appear - wait for modal heading
    await expect(
      page.getByRole('heading', { name: 'Move Chapter' }),
    ).toBeVisible();

    // Wait for lectures to load and verify Lecture Two is visible
    // (Lecture One should not be in the list since it's the current lecture)
    await expect(page.getByText('Lecture Two')).toBeVisible({ timeout: 10000 });

    // Select Lecture Two
    await page.getByRole('button', { name: /Lecture Two/i }).click();

    // Click the move button
    await page.getByRole('button', { name: /Move to this lecture/i }).click();

    // The modal should close
    await expect(
      page.getByRole('heading', { name: 'Move Chapter' }),
    ).not.toBeVisible();
  });
});
