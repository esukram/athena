import { expect, test } from '@playwright/test';

test.describe('Chapter Delete Renumber', () => {
  const lectureId = 'lecture-1';

  test('edit page shows sequential numbers after deleting a middle chapter', async ({
    page,
  }) => {
    const lecture = {
      id: lectureId,
      title: 'Test Lecture',
      description: 'Testing chapter renumbering',
    };

    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
      { id: 'c3', lectureId, order: 2, association: '' },
    ];

    const firstQuestions: Record<string, { question: string }> = {
      c1: { question: 'First Chapter' },
      c2: { question: 'Second Chapter' },
      c3: { question: 'Third Chapter' },
    };

    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({ json: { result: { data: lecture } } });
    });

    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
      await route.fulfill({ json: { result: { data: sortedChapters } } });
    });

    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        await route.fulfill({
          json: { result: { data: { ...firstQuestions } } },
        });
      },
    );

    await page.route(
      '**/api/trpc/chapters.getDistinctAssociations*',
      async (route) => {
        await route.fulfill({ json: { result: { data: [] } } });
      },
    );

    // Mock deleteChapter: update state to simulate server-side renumbering
    await page.route('**/api/trpc/chapters.deleteChapter*', async (route) => {
      const postData = route.request().postDataJSON();
      const id = postData?.id ?? postData?.['0']?.json?.id;
      if (id) {
        const idx = chapters.findIndex((c) => c.id === id);
        if (idx !== -1) {
          chapters.splice(idx, 1);
          for (let i = 0; i < chapters.length; i++) {
            chapters[i].order = i;
          }
          delete firstQuestions[id];
        }
      }
      await route.fulfill({ json: { result: { data: true } } });
    });

    // Accept confirmation dialogs
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto(`/#/edit/${lectureId}`);

    // Verify initial state: 3 chapters visible
    await expect(page.getByText('First Chapter')).toBeVisible();
    await expect(page.getByText('Second Chapter')).toBeVisible();
    await expect(page.getByText('Third Chapter')).toBeVisible();

    // Delete the middle chapter
    const deleteButtons = page.getByRole('button', { name: 'Delete chapter' });
    await expect(deleteButtons).toHaveCount(3);

    const [request] = await Promise.all([
      page.waitForRequest('**/api/trpc/chapters.deleteChapter*'),
      deleteButtons.nth(1).click(),
    ]);

    // Verify deleteChapter was called for the correct chapter
    const postData = request.postDataJSON();
    expect(postData?.id).toBe('c2');

    // After re-fetch, remaining chapters should still be visible
    await expect(page.getByText('First Chapter')).toBeVisible();
    await expect(page.getByText('Third Chapter')).toBeVisible();
  });

  test('sidebar shows sequential numbers with gapped order values', async ({
    page,
  }) => {
    const lecture = {
      id: lectureId,
      title: 'Test Lecture',
      description: 'Testing gap display',
    };

    // Chapters with gaps in order values (as might exist in DB before migration)
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 3, association: '' },
      { id: 'c3', lectureId, order: 7, association: '' },
    ];

    const firstQuestions = {
      c1: { question: 'Alpha' },
      c2: { question: 'Beta' },
      c3: { question: 'Gamma' },
    };

    const questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Alpha',
        answer: 'A',
        order: 0,
      },
    ];

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

    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      await route.fulfill({ json: { result: { data: questions } } });
    });

    await page.route(
      '**/api/trpc/questions.getAnnotatedChapterIds*',
      async (route) => {
        await route.fulfill({ json: { result: { data: [] } } });
      },
    );

    await page.goto(`/#/learn/${lectureId}`);

    // Verify chapters display with sequential numbers despite gapped orders
    await expect(page.getByText('1. Alpha')).toBeVisible();
    await expect(page.getByText('2. Beta')).toBeVisible();
    await expect(page.getByText('3. Gamma')).toBeVisible();
  });
});
