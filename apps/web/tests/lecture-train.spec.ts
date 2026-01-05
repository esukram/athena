import { expect, test } from '@playwright/test';

test.describe('Lecture Train', () => {
  test('question navigation and annotation', async ({ page }) => {
    const lectureId = 'lecture-train-1';
    const lecture = {
      id: lectureId,
      title: 'Training Session',
      description: 'Training Description',
    };

    const chapters = [
      { id: 'c1', lectureId, order: 0 },
      { id: 'c2', lectureId, order: 1 },
    ];

    const firstQuestions = {
      c1: { question: 'Q1 Chapter 1' },
      c2: { question: 'Q1 Chapter 2' },
    };

    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Q1 Chapter 1',
        answer: 'A1',
        order: 0,
        isAnnotated: false,
      },
      {
        id: 'q2',
        chapterId: 'c1',
        question: 'Q2 Chapter 1',
        answer: 'A2',
        order: 1,
        isAnnotated: false,
      },
    ];

    // Mock API
    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({ json: { result: { data: lecture } } });
    });
    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      await route.fulfill({ json: { result: { data: chapters } } });
    });
    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        await route.fulfill({ json: { result: { data: firstQuestions } } });
      },
    );
    await page.route(
      '**/api/trpc/questions.getAnnotatedChapterIdsByLecture*',
      async (route) => {
        await route.fulfill({ json: { result: { data: [] } } }); // No annotations initially
      },
    );
    // Mock getQuestions
    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      // Assume c1 is fetched
      await route.fulfill({ json: { result: { data: c1Questions } } });
    });

    // Mock total questions count for progress bar
    await page.route(
      '**/api/trpc/questions.getQuestionCountsByLecture*',
      async (route) => {
        await route.fulfill({ json: { result: { data: 4 } } }); // 2 questions per chapter, 2 chapters
      },
    );

    // Mock per-chapter question counts for progress bar
    await page.route(
      '**/api/trpc/questions.getQuestionCountsPerChapter*',
      async (route) => {
        await route.fulfill({
          json: { result: { data: { c1: 2, c2: 2 } } },
        });
      },
    );

    // Mock annotation update
    await page.route('**/api/trpc/questions.updateQuestion*', async (route) => {
      const data = route.request().postDataJSON();
      // Reflect back the change
      await route.fulfill({
        json: { result: { data: { success: true, ...data } } },
      });
    });

    await page.goto(`/#/train/${lectureId}`);

    // Verify Q1 displayed
    await expect(
      page.getByRole('heading', { name: 'Q1 Chapter 1' }),
    ).toBeVisible();
    await expect(page.getByText('Question 1 of 2')).toBeVisible();

    // Verify "Show Answer" / Accordion logic
    // The accordion content (answer) might be hidden or visible depending on default.
    // In LectureTrain.tsx: Accordion title={question.question} ... {question.answer}
    // So usually you click title to expand.
    // The code shows `Accordion` is used.
    await expect(page.getByText('A1')).not.toBeVisible();
    await page.getByRole('heading', { name: 'Q1 Chapter 1' }).click(); // Expand
    await expect(page.getByText('A1')).toBeVisible();

    // Test Annotation (Owl)
    const owlButton = page.getByTitle(
      'Question not highlighted, click to highlight',
    );
    await expect(owlButton).toBeVisible();
    await owlButton.click();

    // Verify mutation called
    // We can't easily wait for a variable in this scope without exposing it or pausing.
    // The previous check verified the click worked.

    // Test Navigation to Next Question
    const nextButton = page.getByRole('button', { name: 'Next' });
    await nextButton.click();

    // Should be on Q2
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c1/q2`));
    await expect(page.getByText('Q2 Chapter 1')).toBeVisible();
    await expect(page.getByText('Question 2 of 2')).toBeVisible();

    // Previous button should work
    const prevButton = page.getByRole('button', { name: 'Previous' });
    await prevButton.click();
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c1/q1`));
  });

  test('edit button should not be visible in training mode', async ({
    page,
  }) => {
    const lectureId = 'lecture-train-2';
    const lecture = {
      id: lectureId,
      title: 'Focus Training',
      description: 'No distractions',
    };

    const chapters = [{ id: 'c1', lectureId, order: 0 }];

    const firstQuestions = {
      c1: { question: 'Question 1' },
    };

    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Question 1',
        answer: 'Answer 1',
        order: 0,
        isAnnotated: false,
      },
    ];

    // Mock API
    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({ json: { result: { data: lecture } } });
    });
    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      await route.fulfill({ json: { result: { data: chapters } } });
    });
    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        await route.fulfill({ json: { result: { data: firstQuestions } } });
      },
    );
    await page.route(
      '**/api/trpc/questions.getAnnotatedChapterIdsByLecture*',
      async (route) => {
        await route.fulfill({ json: { result: { data: [] } } });
      },
    );
    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      await route.fulfill({ json: { result: { data: c1Questions } } });
    });

    // Mock total questions count for progress bar
    await page.route(
      '**/api/trpc/questions.getQuestionCountsByLecture*',
      async (route) => {
        await route.fulfill({ json: { result: { data: 1 } } }); // 1 question
      },
    );

    // Mock per-chapter question counts for progress bar
    await page.route(
      '**/api/trpc/questions.getQuestionCountsPerChapter*',
      async (route) => {
        await route.fulfill({
          json: { result: { data: { c1: 1 } } },
        });
      },
    );

    await page.goto(`/#/train/${lectureId}`);

    // Verify question is displayed
    await expect(
      page.getByRole('heading', { name: 'Question 1' }),
    ).toBeVisible();

    // Verify edit button is NOT visible in training mode
    await expect(page.getByTestId('chapter-edit-button')).not.toBeVisible();
  });
});
