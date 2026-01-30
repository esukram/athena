import { expect, test } from '@playwright/test';

test.describe('Auto-Save Chapter Questions', () => {
  const lectureId = 'lecture-auto-save-1';
  const chapterId = 'chapter-1';

  test('auto-saves when clicking Add Question on existing chapter', async ({
    page,
  }) => {
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
    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      await route.fulfill({ json: { result: { data: existingQuestions } } });
    });

    // Track if updateQuestion was called
    let updateQuestionCalled = false;

    await page.route('**/api/trpc/questions.updateQuestion*', async (route) => {
      updateQuestionCalled = true;
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

    // Click Add Question - this should trigger auto-save
    await page.getByRole('button', { name: 'Add Question' }).click();

    // Wait for auto-save
    await page.waitForTimeout(500);

    // Verify that updateQuestion was called to save the existing question
    expect(updateQuestionCalled).toBe(true);

    // Verify toast appears
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByText('Changes saved')).toBeVisible();
  });

  test('auto-saves when clicking Add Question on new chapter', async ({
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

    // Track if createChapter and createQuestion were called
    let createChapterCalled = false;
    let createQuestionCalled = false;

    await page.route('**/api/trpc/chapters.createChapter*', async (route) => {
      createChapterCalled = true;
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

    await page.route('**/api/trpc/questions.createQuestion*', async (route) => {
      createQuestionCalled = true;
      const postData = route.request().postDataJSON();
      await route.fulfill({
        json: {
          result: {
            data: { id: 'new-q-id', ...postData },
          },
        },
      });
    });

    // Navigate to edit page
    await page.goto(`/#/edit/${lectureId}`);

    // Add a new chapter with initial question text
    const newChapterInput = page.getByPlaceholder('New chapter question');
    await newChapterInput.fill('First Question');
    await page.getByRole('button', { name: 'Add' }).click();

    // Modal should open with pre-populated question
    await expect(
      page.getByRole('heading', { name: 'Edit Chapter' }),
    ).toBeVisible();

    // Click Add Question - this should trigger auto-save for the new chapter
    await page.getByRole('button', { name: 'Add Question' }).click();

    // Wait for auto-save
    await page.waitForTimeout(500);

    // Verify chapter and question were created
    expect(createChapterCalled).toBe(true);
    expect(createQuestionCalled).toBe(true);

    // Verify toast appears
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('does NOT auto-save just by editing question text', async ({ page }) => {
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
    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      await route.fulfill({ json: { result: { data: existingQuestions } } });
    });

    // Track if updateQuestion was called
    let updateQuestionCalled = false;

    await page.route('**/api/trpc/questions.updateQuestion*', async (route) => {
      updateQuestionCalled = true;
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

    // Edit the question text (but don't click Add Question)
    const questionInput = page.getByPlaceholder('Enter question');
    await questionInput.fill('Modified Question Text');

    // Wait to see if auto-save triggers (it shouldn't)
    await page.waitForTimeout(2000);

    // Verify that updateQuestion was NOT called
    expect(updateQuestionCalled).toBe(false);

    // Verify no toast appears
    await expect(page.getByRole('status')).not.toBeVisible();
  });
});
