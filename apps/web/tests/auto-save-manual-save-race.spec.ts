import { expect, test } from '@playwright/test';

test.describe('Manual save during an in-flight auto-save', () => {
  const lectureId = 'lecture-autosave-race-1';

  test('updates the question auto-save created instead of creating it again', async ({
    page,
  }) => {
    await page.route('**/api/trpc/lectures.getLecture?*', (route) =>
      route.fulfill({
        json: {
          result: { data: { id: lectureId, title: 'T', description: '' } },
        },
      }),
    );
    for (const path of [
      'chapters.getChapters',
      'chapters.getDistinctAssociations',
      'questions.getQuestions',
    ]) {
      await page.route(`**/api/trpc/${path}*`, (route) =>
        route.fulfill({ json: { result: { data: [] } } }),
      );
    }
    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      (route) => route.fulfill({ json: { result: { data: {} } } }),
    );
    await page.route('**/api/trpc/chapters.createChapter*', (route) =>
      route.fulfill({
        json: {
          result: {
            data: { id: 'chapter-1', lectureId, order: 0, association: '' },
          },
        },
      }),
    );

    // Hold auto-save's createQuestion response until the manual save is underway.
    let createQuestionCalls = 0;
    let releaseCreate!: () => void;
    const createReleased = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    await page.route('**/api/trpc/questions.createQuestion*', async (route) => {
      createQuestionCalls++;
      const input = route.request().postDataJSON();
      await createReleased;
      await route.fulfill({
        json: { result: { data: { id: 'question-1', ...input } } },
      });
    });

    const updatedIds: string[] = [];
    await page.route('**/api/trpc/questions.updateQuestion*', async (route) => {
      updatedIds.push(route.request().postDataJSON().id);
      await route.fulfill({ json: { result: { data: { success: true } } } });
    });

    await page.goto(`/#/edit/${lectureId}`);
    await page.getByPlaceholder('New chapter question').fill('First Question');
    await page.getByRole('button', { name: 'Add' }).click();
    await page
      .getByPlaceholder('Write your answer in Markdown...')
      .fill('First Answer');

    // Add Question triggers auto-save; wait until its create is in flight.
    await page.getByRole('button', { name: 'Add Question' }).click();
    await expect.poll(() => createQuestionCalls).toBe(1);

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    releaseCreate();

    await expect(
      page.getByRole('heading', { name: 'Edit Chapter' }),
    ).not.toBeVisible();
    await expect.poll(() => updatedIds).toEqual(['question-1']);
    expect(createQuestionCalls).toBe(1);
  });
});
