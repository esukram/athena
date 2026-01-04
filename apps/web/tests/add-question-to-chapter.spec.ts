import { expect, test } from '@playwright/test';

test.describe('Add Question to Existing Chapter', () => {
  const lectureId = 'lecture-add-question-1';
  const chapterId = 'chapter-1';

  test('add a question to an existing chapter', async ({ page }) => {
    // Setup: Mock lecture data
    const lecture = {
      id: lectureId,
      title: 'Test Lecture',
      description: 'Test Description',
    };
    const chapters = [
      { id: chapterId, lectureId, order: 0, association: 'Test Association' },
    ];
    const existingQuestions = [
      {
        id: 'q1',
        chapterId,
        question: 'Existing Question',
        answer: 'Existing Answer',
        order: 0,
        isAnnotated: false,
      },
    ];
    const firstQuestions = {
      [chapterId]: { question: 'Existing Question' },
    };

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
        await route.fulfill({
          json: { result: { data: ['Test Association'] } },
        });
      },
    );
    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        await route.fulfill({ json: { result: { data: firstQuestions } } });
      },
    );

    // Mock getQuestions - returns existing questions when editing a chapter
    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      await route.fulfill({ json: { result: { data: existingQuestions } } });
    });

    // Track if createQuestion was called
    let createQuestionCalled = false;
    let createQuestionPayload: unknown = null;

    await page.route('**/api/trpc/questions.createQuestion*', async (route) => {
      createQuestionCalled = true;
      const postData = route.request().postDataJSON();
      createQuestionPayload = postData;
      await route.fulfill({
        json: {
          result: {
            data: { id: 'new-q-id', ...postData },
          },
        },
      });
    });

    // Mock updateQuestion (for existing question)
    await page.route('**/api/trpc/questions.updateQuestion*', async (route) => {
      await route.fulfill({
        json: { result: { data: { success: true } } },
      });
    });

    // Navigate to edit page
    await page.goto(`/#/edit/${lectureId}`);

    // Wait for the chapter to be visible
    await expect(page.getByText('Existing Question')).toBeVisible();

    // Click the edit button for the chapter
    await page.getByRole('button', { name: 'Edit Chapter' }).click();

    // Verify the modal is open
    await expect(
      page.getByRole('heading', { name: 'Edit Chapter' }),
    ).toBeVisible();

    // Verify existing question is shown (should be expanded by default)
    await expect(page.getByPlaceholder('Enter question')).toHaveValue(
      'Existing Question',
    );

    // Click "Add Question" button to add a new question
    await page.getByRole('button', { name: 'Add Question' }).click();

    // The accordion collapses the existing question and expands the new one
    // So the visible input should now be empty (the new question)
    const questionInput = page.getByPlaceholder('Enter question');
    await expect(questionInput).toHaveValue('');

    // Fill in the new question
    await questionInput.fill('New Question Text');

    // Save the chapter
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Modal should close
    await expect(
      page.getByRole('heading', { name: 'Edit Chapter' }),
    ).not.toBeVisible();

    // Verify that createQuestion was called for the new question
    expect(createQuestionCalled).toBe(true);
    expect(createQuestionPayload).toBeTruthy();
  });
});
