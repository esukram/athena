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

    // The Train screen is now a flip card. The question text shows on the card
    // front, with a "Question" side label; the answer stays hidden until flip.
    await expect(page.getByText('Q1 Chapter 1')).toBeVisible();
    await expect(page.getByText('Question 1 of 2')).toBeVisible();
    await expect(page.getByText('Question', { exact: true })).toBeVisible();
    await expect(page.getByText('A1')).not.toBeVisible();

    // Annotation (owl) lives on the card front; its title is unchanged.
    const owlButton = page.getByTitle(
      'Question not highlighted, click to highlight',
    );
    await expect(owlButton).toBeVisible();
    await owlButton.click();

    // Flipping the card reveals the answer and switches the side label to
    // "Answer". Use the dedicated "Flip card" button (clicking the card or
    // pressing Space would work too).
    await page.getByRole('button', { name: 'Flip card' }).click();
    await expect(page.getByText('A1')).toBeVisible();
    await expect(page.getByText('Answer', { exact: true })).toBeVisible();

    // The rate buttons replace flip/nav on the back; "Got it" advances to the
    // next card. (The owl click above persisted the highlight, so c1 is fetched
    // again on navigation — the mocked list is returned verbatim.)
    await page.getByRole('button', { name: 'Got it' }).click();

    // Should be on Q2, front side again.
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c1/q2`));
    await expect(page.getByText('Q2 Chapter 1')).toBeVisible();
    await expect(page.getByText('Question 2 of 2')).toBeVisible();

    // The round Previous nav (visible on the card front) navigates back.
    const prevButton = page.getByRole('button', { name: 'Previous' });
    await prevButton.click();
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c1/q1`));

    // "Review again" is the other rate button: flip, then rate to advance.
    await page.getByRole('button', { name: 'Flip card' }).click();
    await page.getByRole('button', { name: 'Review again' }).click();
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c1/q2`));
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

    // Verify the question is displayed on the flip-card front (a div, not a
    // heading).
    await expect(page.getByText('Question 1')).toBeVisible();

    // Verify edit button is NOT visible in training mode
    await expect(page.getByTestId('chapter-edit-button')).not.toBeVisible();
  });
});
