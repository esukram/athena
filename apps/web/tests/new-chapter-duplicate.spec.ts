import { expect, test } from '@playwright/test';

test.describe('New Chapter Duplicate Bug', () => {
  const lectureId = 'lecture-dup-test-1';

  test('saving a new chapter with two questions creates only one chapter', async ({
    page,
  }) => {
    // Setup: Mock lecture data
    const lecture = {
      id: lectureId,
      title: 'Test Lecture',
      description: 'Test Description',
    };
    const chapters: unknown[] = [];
    const firstQuestions = {};

    // Track createChapter call count
    let createChapterCallCount = 0;

    // Mock API routes
    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({ json: { result: { data: lecture } } });
    });
    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      await route.fulfill({ json: { result: { data: chapters } } });
    });
    await page.route(
      '**/api/trpc/chapters.getDistinctAssociations*',
      async (route) => {
        await route.fulfill({ json: { result: { data: [] } } });
      },
    );
    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        await route.fulfill({ json: { result: { data: firstQuestions } } });
      },
    );

    await page.route('**/api/trpc/chapters.createChapter*', async (route) => {
      createChapterCallCount++;
      await route.fulfill({
        json: {
          result: {
            data: {
              id: 'new-chapter-id',
              lectureId,
              order: 0,
              association: '',
            },
          },
        },
      });
    });

    let createQuestionCallCount = 0;
    await page.route('**/api/trpc/questions.createQuestion*', async (route) => {
      createQuestionCallCount++;
      const postData = route.request().postDataJSON();
      await route.fulfill({
        json: {
          result: {
            data: {
              id: `new-q-id-${createQuestionCallCount}`,
              chapterId: 'new-chapter-id',
              ...postData,
            },
          },
        },
      });
    });

    await page.route('**/api/trpc/chapters.updateChapter*', async (route) => {
      await route.fulfill({
        json: {
          result: {
            data: {
              id: 'new-chapter-id',
              lectureId,
              order: 0,
              association: '',
            },
          },
        },
      });
    });

    await page.route('**/api/trpc/questions.updateQuestion*', async (route) => {
      await route.fulfill({
        json: { result: { data: { success: true } } },
      });
    });

    // Navigate to edit page
    await page.goto(`/#/edit/${lectureId}`);

    // Step 1: Type a new chapter question and click Add
    const newChapterInput = page.getByPlaceholder('New chapter question');
    await newChapterInput.fill('Test Question One');
    await page.getByRole('button', { name: 'Add' }).click();

    // Modal should open
    await expect(
      page.getByRole('heading', { name: 'Edit Chapter' }),
    ).toBeVisible();

    // Step 2: Fill in the answer for the first question
    await page
      .getByPlaceholder('Write your answer in Markdown...')
      .fill('Answer for question one');

    // Step 3: Click "Add Question" — this triggers auto-save
    await page.getByRole('button', { name: 'Add Question' }).click();

    // Wait for auto-save to complete
    await page.waitForTimeout(500);

    // Step 4: Fill in the second question and answer
    await page.getByPlaceholder('Enter question').fill('Test Question Two');
    await page
      .getByPlaceholder('Write your answer in Markdown...')
      .fill('Answer for question two');

    // Step 5: Click Save
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Wait for save to complete
    await page.waitForTimeout(500);

    // ASSERT: createChapter should have been called exactly ONCE
    // The bug causes it to be called twice (once by auto-save, once by handleSaveEdit)
    expect(createChapterCallCount).toBe(1);
  });
});
