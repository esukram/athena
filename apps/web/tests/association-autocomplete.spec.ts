import { expect, test } from '@playwright/test';

/**
 * E2E test for issue #38: Association auto-complete fails sometimes
 *
 * This test verifies that:
 * 1. All newly added associations appear in the autocomplete dropdown
 * 2. Associations are visible immediately after saving (no page refresh needed)
 */
test.describe('Association Autocomplete', () => {
  const lectureId = 'lecture-assoc-test';

  test('newly added associations appear in autocomplete dropdown', async ({
    page,
  }) => {
    // Track associations dynamically
    const allAssociations: string[] = [];
    const chapters: Array<{
      id: string;
      lectureId: string;
      order: number;
      association: string;
    }> = [];
    let questionIdCounter = 0;
    let chapterIdCounter = 0;

    const lecture = {
      id: lectureId,
      title: 'Association Test Lecture',
      description: 'Testing association autocomplete',
    };

    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({ json: { result: { data: lecture } } });
    });

    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      await route.fulfill({ json: { result: { data: chapters } } });
    });

    await page.route(
      '**/api/trpc/chapters.getDistinctAssociations*',
      async (route) => {
        // Return unique, non-empty associations
        const uniqueAssociations = [
          ...new Set(allAssociations.filter((a) => a && a.trim() !== '')),
        ].sort();
        await route.fulfill({ json: { result: { data: uniqueAssociations } } });
      },
    );

    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        const firstQuestions: Record<string, { question: string }> = {};
        for (const chapter of chapters) {
          firstQuestions[chapter.id] = {
            question: `Question for ${chapter.association || 'chapter'}`,
          };
        }
        await route.fulfill({ json: { result: { data: firstQuestions } } });
      },
    );

    await page.route('**/api/trpc/chapters.createChapter*', async (route) => {
      const body = route.request().postDataJSON();
      const input = body?.['0']?.json || body;
      chapterIdCounter++;
      const newChapter = {
        id: `chapter-${chapterIdCounter}`,
        lectureId: input.lectureId,
        order: input.order,
        association: input.association || '',
      };
      chapters.push(newChapter);
      if (newChapter.association) {
        allAssociations.push(newChapter.association);
      }
      await route.fulfill({ json: { result: { data: newChapter } } });
    });

    await page.route('**/api/trpc/chapters.updateChapter*', async (route) => {
      const body = route.request().postDataJSON();
      const input = body?.['0']?.json || body;
      const chapter = chapters.find((c) => c.id === input.id);
      if (chapter && input.association !== undefined) {
        chapter.association = input.association;
        if (input.association && !allAssociations.includes(input.association)) {
          allAssociations.push(input.association);
        }
      }
      await route.fulfill({ json: { result: { data: chapter } } });
    });

    await page.route('**/api/trpc/questions.createQuestion*', async (route) => {
      const body = route.request().postDataJSON();
      const input = body?.['0']?.json || body;
      questionIdCounter++;
      const newQuestion = {
        id: `question-${questionIdCounter}`,
        chapterId: input.chapterId,
        question: input.question,
        answer: input.answer,
        order: input.order,
      };
      await route.fulfill({ json: { result: { data: newQuestion } } });
    });

    await page.route('**/api/trpc/questions.getQuestions*', async (route) => {
      await route.fulfill({ json: { result: { data: [] } } });
    });

    // Navigate to the edit page
    await page.goto(`/#/edit/${lectureId}`);

    // Wait for the page to load
    await expect(page.getByPlaceholder('New chapter question')).toBeVisible();

    // Create 5 chapters with unique associations
    const associations = [
      'Biology',
      'Chemistry',
      'Physics',
      'Mathematics',
      'History',
    ];

    for (const association of associations) {
      // Type in the new chapter question input
      const newQuestionInput = page.getByPlaceholder('New chapter question');
      await newQuestionInput.fill(`Question about ${association}`);
      await page.getByRole('button', { name: 'Add' }).click();

      // Wait for the edit modal to open
      await expect(
        page.getByRole('heading', { name: 'Edit Chapter' }),
      ).toBeVisible();

      // Fill in the association
      const associationInput = page.getByPlaceholder('Enter association');
      await associationInput.fill(association);

      // Save the chapter
      await page.getByRole('button', { name: 'Save', exact: true }).click();

      // Modal should close
      await expect(
        page.getByRole('heading', { name: 'Edit Chapter' }),
      ).not.toBeVisible();
    }

    // Now open a new chapter to verify all associations appear in dropdown
    const newQuestionInput = page.getByPlaceholder('New chapter question');
    await newQuestionInput.fill('Final question');
    await page.getByRole('button', { name: 'Add' }).click();

    // Wait for the edit modal
    await expect(
      page.getByRole('heading', { name: 'Edit Chapter' }),
    ).toBeVisible();

    // Focus the association input to trigger dropdown
    const associationInput = page.getByPlaceholder('Enter association');
    await associationInput.focus();

    // Verify all 5 associations appear in the dropdown
    for (const association of associations) {
      await expect(
        page.getByRole('button', { name: association }),
      ).toBeVisible();
    }
  });

  test('autocomplete shows matching associations when typing', async ({
    page,
  }) => {
    // Track associations dynamically
    const allAssociations: string[] = [];
    const chapters: Array<{
      id: string;
      lectureId: string;
      order: number;
      association: string;
    }> = [];
    let questionIdCounter = 0;
    let chapterIdCounter = 0;

    const lecture = {
      id: lectureId,
      title: 'Association Test Lecture',
      description: 'Testing association autocomplete',
    };

    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({ json: { result: { data: lecture } } });
    });

    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      await route.fulfill({ json: { result: { data: chapters } } });
    });

    await page.route(
      '**/api/trpc/chapters.getDistinctAssociations*',
      async (route) => {
        const uniqueAssociations = [
          ...new Set(allAssociations.filter((a) => a && a.trim() !== '')),
        ].sort();
        await route.fulfill({ json: { result: { data: uniqueAssociations } } });
      },
    );

    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        const firstQuestions: Record<string, { question: string }> = {};
        for (const chapter of chapters) {
          firstQuestions[chapter.id] = {
            question: `Question for ${chapter.association || 'chapter'}`,
          };
        }
        await route.fulfill({ json: { result: { data: firstQuestions } } });
      },
    );

    await page.route('**/api/trpc/chapters.createChapter*', async (route) => {
      const body = route.request().postDataJSON();
      const input = body?.['0']?.json || body;
      chapterIdCounter++;
      const newChapter = {
        id: `chapter-${chapterIdCounter}`,
        lectureId: input.lectureId,
        order: input.order,
        association: input.association || '',
      };
      chapters.push(newChapter);
      if (newChapter.association) {
        allAssociations.push(newChapter.association);
      }
      await route.fulfill({ json: { result: { data: newChapter } } });
    });

    await page.route('**/api/trpc/chapters.updateChapter*', async (route) => {
      const body = route.request().postDataJSON();
      const input = body?.['0']?.json || body;
      const chapter = chapters.find((c) => c.id === input.id);
      if (chapter && input.association !== undefined) {
        chapter.association = input.association;
        if (input.association && !allAssociations.includes(input.association)) {
          allAssociations.push(input.association);
        }
      }
      await route.fulfill({ json: { result: { data: chapter } } });
    });

    await page.route('**/api/trpc/questions.createQuestion*', async (route) => {
      const body = route.request().postDataJSON();
      const input = body?.['0']?.json || body;
      questionIdCounter++;
      const newQuestion = {
        id: `question-${questionIdCounter}`,
        chapterId: input.chapterId,
        question: input.question,
        answer: input.answer,
        order: input.order,
      };
      await route.fulfill({ json: { result: { data: newQuestion } } });
    });

    await page.route('**/api/trpc/questions.getQuestions*', async (route) => {
      await route.fulfill({ json: { result: { data: [] } } });
    });

    // Navigate to the edit page
    await page.goto(`/#/edit/${lectureId}`);

    // Wait for the page to load
    await expect(page.getByPlaceholder('New chapter question')).toBeVisible();

    // Create chapters with similar association names
    const associations = ['Science-Bio', 'Science-Chem', 'Math-Algebra'];

    for (const assoc of associations) {
      const newQuestionInput = page.getByPlaceholder('New chapter question');
      await newQuestionInput.fill(`Question for ${assoc}`);
      await page.getByRole('button', { name: 'Add' }).click();

      await expect(
        page.getByRole('heading', { name: 'Edit Chapter' }),
      ).toBeVisible();

      const associationInput = page.getByPlaceholder('Enter association');
      await associationInput.fill(assoc);
      await page.getByRole('button', { name: 'Save', exact: true }).click();

      await expect(
        page.getByRole('heading', { name: 'Edit Chapter' }),
      ).not.toBeVisible();
    }

    // Open new chapter and test filtering
    const newQuestionInput = page.getByPlaceholder('New chapter question');
    await newQuestionInput.fill('Filter test');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(
      page.getByRole('heading', { name: 'Edit Chapter' }),
    ).toBeVisible();

    // Type "Science" to filter
    const associationInput = page.getByPlaceholder('Enter association');
    await associationInput.fill('Science');

    // Should show Science-Bio and Science-Chem but not Math-Algebra
    await expect(
      page.getByRole('button', { name: 'Science-Bio' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Science-Chem' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Math-Algebra' }),
    ).not.toBeVisible();
  });
});
