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

    const question = (id: string, chapterId: string, text: string) => ({
      id,
      chapterId,
      question: text,
      answer: `Answer to ${text}`,
      order: 0,
      isAnnotated: false,
    });
    const questionsByChapter: Record<string, unknown[]> = {
      c1: [
        { ...question('q1', 'c1', 'Q1 Chapter 1'), answer: 'A1' },
        { ...question('q2', 'c1', 'Q2 Chapter 1'), answer: 'A2', order: 1 },
      ],
      c2: [
        question('q3', 'c2', 'Q1 Chapter 2'),
        { ...question('q4', 'c2', 'Q2 Chapter 2'), order: 1 },
      ],
    };

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
    // Each Chapter answers with its own Questions.
    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      const input = JSON.parse(
        new URL(route.request().url()).searchParams.get('input') || '{}',
      );
      await route.fulfill({
        json: { result: { data: questionsByChapter[input.chapterId] ?? [] } },
      });
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
    await expect(page.getByText('Q1 Chapter 1', { exact: true })).toBeVisible();
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

    // A new card always starts on its question side.
    await expect(page.getByRole('button', { name: 'Flip card' })).toBeVisible();

    // Next from the last Question crosses into Chapter 2 at its start...
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c2$`));
    await expect(page.getByText('Q1 Chapter 2', { exact: true })).toBeVisible();

    // ...and Previous returns to Chapter 1's last Question.
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c1/q2$`));
    await expect(page.getByText('Q2 Chapter 1')).toBeVisible();
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
    // heading). Match exactly: the chapter sidebar ("1. Question 1") and the
    // progress counter ("Question 1 of 1") also contain this substring.
    await expect(page.getByText('Question 1', { exact: true })).toBeVisible();

    // Verify edit button is NOT visible in training mode
    await expect(page.getByTestId('chapter-edit-button')).not.toBeVisible();
  });

  test('stale question link shows not found and leads to the chapter', async ({
    page,
  }) => {
    const lectureId = 'lecture-train-3';
    const lecture = { id: lectureId, title: 'Stale', description: 'Links' };
    const chapters = [{ id: 'c1', lectureId, order: 0 }];
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Only question',
        answer: 'Only answer',
        order: 0,
        isAnnotated: false,
      },
    ];
    const data: Record<string, unknown> = {
      'lectures.getLecture': lecture,
      'chapters.getChapters': chapters,
      'questions.getFirstQuestionsByLecture': { c1: c1Questions[0] },
      'questions.getAnnotatedChapterIdsByLecture': [],
      'questions.getQuestions': c1Questions,
      'questions.getQuestionCountsByLecture': 1,
      'questions.getQuestionCountsPerChapter': { c1: 1 },
    };
    await page.route('**/api/trpc/*', async (route) => {
      const procedure = new URL(route.request().url()).pathname
        .split('/')
        .pop()!;
      await route.fulfill({ json: { result: { data: data[procedure] } } });
    });

    // A pasted link is the first history entry: there is nothing to go back to.
    await page.goto(`/#/train/${lectureId}/c1/deleted-question`);

    await expect(
      page.getByText("This question doesn't exist in this chapter."),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Back', exact: true }),
    ).toHaveCount(0);

    await page
      .getByRole('button', { name: 'Go to the start of the chapter' })
      .click();

    await expect(page).toHaveURL(new RegExp(`/train/${lectureId}/c1$`));
    await expect(
      page.getByText('Only question', { exact: true }),
    ).toBeVisible();
  });

  test('randomized order and progress survive a reload', async ({ page }) => {
    const lectureId = 'lecture-train-4';
    const chapterIds = ['c1', 'c2', 'c3'];
    const questionsByChapter = Object.fromEntries(
      chapterIds.map((id) => [
        id,
        [
          {
            id: `q-${id}`,
            chapterId: id,
            question: `Only question of ${id}`,
            answer: `Answer of ${id}`,
            order: 0,
            isAnnotated: false,
          },
        ],
      ]),
    );
    const data: Record<string, unknown> = {
      'lectures.getLecture': { id: lectureId, title: 'Shuffled' },
      'chapters.getChapters': chapterIds.map((id, order) => ({
        id,
        lectureId,
        order,
      })),
      'questions.getFirstQuestionsByLecture': Object.fromEntries(
        chapterIds.map((id) => [id, questionsByChapter[id][0]]),
      ),
      'questions.getAnnotatedChapterIdsByLecture': [],
      'questions.getQuestionCountsByLecture': 3,
      'questions.getQuestionCountsPerChapter': { c1: 1, c2: 1, c3: 1 },
    };
    await page.route('**/api/trpc/*', async (route) => {
      const url = new URL(route.request().url());
      const procedure = url.pathname.split('/').pop()!;
      const input = JSON.parse(url.searchParams.get('input') || '{}');
      await route.fulfill({
        json: {
          result: {
            data:
              procedure === 'questions.getQuestions'
                ? questionsByChapter[input.chapterId]
                : data[procedure],
          },
        },
      });
    });

    // Entering without a seed settles on a canonical URL that carries one.
    await page.goto(`/#/train-random/${lectureId}`);
    await expect(page).toHaveURL(/\?seed=\d+$/);

    // Seed 42 orders the Chapters c3, c1, c2.
    const card = (chapterId: string) =>
      page.getByText(`Only question of ${chapterId}`, { exact: true }).first();
    await page.goto(`/#/train-random/${lectureId}?seed=42`);
    await expect(card('c3')).toBeVisible();
    await expect(page.getByText('Chapter 1/3 · Question 1/1')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/train-random/${lectureId}/c1\\?seed=42$`),
    );
    await expect(page.getByText('Chapter 2/3 · Question 1/1')).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(
      new RegExp(`/train-random/${lectureId}/c1\\?seed=42$`),
    );
    await expect(card('c1')).toBeVisible();
    await expect(page.getByText('Chapter 2/3 · Question 1/1')).toBeVisible();

    // Next follows the same order after the reload.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/train-random/${lectureId}/c2\\?seed=42$`),
    );
  });
});
