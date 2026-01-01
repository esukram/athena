import { expect, test } from '@playwright/test';

test.describe('Reorder Chapters', () => {
  test.beforeEach(async ({ page }) => {
    const lectures = [
      { id: 'lecture-1', title: 'Lecture One', description: 'First lecture' },
    ];

    const chapters = [
      { id: 'chapter-1', lectureId: 'lecture-1', association: '', order: 0 },
      { id: 'chapter-2', lectureId: 'lecture-1', association: '', order: 1 },
      { id: 'chapter-3', lectureId: 'lecture-1', association: '', order: 2 },
    ];

    const firstQuestions: Record<
      string,
      {
        id: string;
        chapterId: string;
        question: string;
        answer: string;
        order: number;
        isAnnotated: boolean;
      }
    > = {
      'chapter-1': {
        id: 'q-1',
        chapterId: 'chapter-1',
        question: 'Introduction',
        answer: 'First chapter answer',
        order: 0,
        isAnnotated: false,
      },
      'chapter-2': {
        id: 'q-2',
        chapterId: 'chapter-2',
        question: 'Sample Header',
        answer: 'Second chapter answer',
        order: 0,
        isAnnotated: false,
      },
      'chapter-3': {
        id: 'q-3',
        chapterId: 'chapter-3',
        question: 'Outro',
        answer: 'Third chapter answer',
        order: 0,
        isAnnotated: false,
      },
    };

    // Mock getLectures
    await page.route('**/api/trpc/lectures.getLectures*', async (route) => {
      await route.fulfill({
        json: { result: { data: lectures } },
      });
    });

    // Mock getLecture
    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({
        json: { result: { data: lectures[0] } },
      });
    });

    // Mock getChapters - returns sorted by order
    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
      await route.fulfill({
        json: { result: { data: sortedChapters } },
      });
    });

    // Mock getFirstQuestionsByLecture
    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        await route.fulfill({
          json: { result: { data: firstQuestions } },
        });
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

    // Mock reorderChapter
    await page.route('**/api/trpc/chapters.reorderChapter*', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();
      const input = postData?.['0']?.json;

      if (input) {
        const { chapterId, newOrder } = input;
        const chapter = chapters.find((c) => c.id === chapterId);

        if (chapter) {
          const oldOrder = chapter.order;

          if (newOrder < oldOrder) {
            // Moving up
            for (const c of chapters) {
              if (c.order >= newOrder && c.order < oldOrder) {
                c.order += 1;
              }
            }
          } else if (newOrder > oldOrder) {
            // Moving down
            for (const c of chapters) {
              if (c.order > oldOrder && c.order <= newOrder) {
                c.order -= 1;
              }
            }
          }

          chapter.order = newOrder;
        }

        await route.fulfill({
          json: { result: { data: chapter } },
        });
      }
    });
  });

  test('displays up/down arrows and position dropdown for each chapter', async ({
    page,
  }) => {
    await page.goto('/#/edit/lecture-1');

    // Wait for chapters to load
    await expect(page.getByText('Introduction')).toBeVisible();
    await expect(page.getByText('Sample Header')).toBeVisible();
    await expect(page.getByText('Outro')).toBeVisible();

    // Check that up/down buttons exist
    const moveUpButtons = page.getByRole('button', { name: 'Move up' });
    const moveDownButtons = page.getByRole('button', { name: 'Move down' });

    await expect(moveUpButtons).toHaveCount(3);
    await expect(moveDownButtons).toHaveCount(3);

    // Check that position dropdowns exist
    const positionDropdowns = page.getByRole('combobox', {
      name: 'Chapter position',
    });
    await expect(positionDropdowns).toHaveCount(3);
  });

  test('first chapter has disabled up button', async ({ page }) => {
    await page.goto('/#/edit/lecture-1');

    await expect(page.getByText('Introduction')).toBeVisible();

    // First chapter's up button should be disabled (first one in the list)
    const upButtons = page.getByRole('button', { name: 'Move up' });
    await expect(upButtons.first()).toBeDisabled();
  });

  test('last chapter has disabled down button', async ({ page }) => {
    await page.goto('/#/edit/lecture-1');

    await expect(page.getByText('Outro')).toBeVisible();

    // Last chapter's down button should be disabled (last one in the list)
    const downButtons = page.getByRole('button', { name: 'Move down' });
    await expect(downButtons.last()).toBeDisabled();
  });

  test('clicking up arrow on second chapter triggers reorder', async ({
    page,
  }) => {
    await page.goto('/#/edit/lecture-1');
    await expect(page.getByText('Introduction')).toBeVisible();

    // Second chapter's up button should be enabled
    const upButtons = page.getByRole('button', { name: 'Move up' });
    await expect(upButtons.nth(1)).toBeEnabled();

    // Click should not throw an error
    await upButtons.nth(1).click();

    // Button should still be visible after click (UI doesn't break)
    await expect(upButtons.nth(0)).toBeVisible();
  });

  test('clicking down arrow on first chapter triggers reorder', async ({
    page,
  }) => {
    await page.goto('/#/edit/lecture-1');
    await expect(page.getByText('Introduction')).toBeVisible();

    // First chapter's down button should be enabled
    const downButtons = page.getByRole('button', { name: 'Move down' });
    await expect(downButtons.first()).toBeEnabled();

    // Click should not throw an error
    await downButtons.first().click();

    // Button should still be visible after click (UI doesn't break)
    await expect(downButtons.first()).toBeVisible();
  });

  test('selecting position from dropdown triggers reorder', async ({
    page,
  }) => {
    await page.goto('/#/edit/lecture-1');
    await expect(page.getByText('Introduction')).toBeVisible();

    // Get the first chapter's position dropdown
    const dropdowns = page.getByRole('combobox', { name: 'Chapter position' });
    const firstDropdown = dropdowns.first();

    // Should be able to select a different position
    await expect(firstDropdown).toBeEnabled();
    await firstDropdown.selectOption('2');

    // Dropdown should still be visible after selection (UI doesn't break)
    await expect(firstDropdown).toBeVisible();
  });

  test('dropdown shows numerical labels for all positions', async ({
    page,
  }) => {
    await page.goto('/#/edit/lecture-1');

    await expect(page.getByText('Introduction')).toBeVisible();

    // Get the first chapter's dropdown
    const dropdowns = page.getByRole('combobox', { name: 'Chapter position' });
    const dropdown = dropdowns.first();

    // Check dropdown options
    const options = dropdown.locator('option');
    await expect(options.nth(0)).toHaveText('1');
    await expect(options.nth(1)).toHaveText('2');
    await expect(options.nth(2)).toHaveText('3');
  });
});
