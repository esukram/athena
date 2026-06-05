import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const en = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/locales/en.json'), 'utf-8'),
);

test.describe('Lecture Overview', () => {
  // We can test localized strings by looping through locales or just picking one (e.g., 'en').
  // Since the app defaults to 'en' or detects browser lang, let's force 'en' via localStorage or just check 'en' strings for simplicity.
  // Given previous conversations about i18n, let's assume 'en' is default or we can set it.

  test.beforeEach(async ({ page }) => {
    // Clear storage to ensure clean state
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('Empty database: Startscreen', async ({ page }) => {
    // Mock getLectures to return empty array
    await page.route('**/api/trpc/lectures.getLectures*', async (route) => {
      await route.fulfill({
        json: {
          result: {
            data: [],
          },
        },
      });
    });

    await page.goto('/');

    // Check for the "Available Lectures" header
    await expect(
      page.getByRole('heading', { name: en.overview.availableLectures }),
    ).toBeVisible();

    // Check for the "Explore our collection..." subtext
    await expect(page.getByText(en.overview.exploreCollection)).toBeVisible();

    // Check that NO lecture cards are visible
    // Lecture cards have a "Train" button, we can check for that, or check the grid container is empty.
    // Better: assert that no element with "LectureCard" characteristics is present.
    // Based on LectureCard.tsx, the title is in an h2.
    // If empty, the grid should be empty.

    // Current Overview.tsx uses div for the grid.
    // Let's count h2s inside the main area, or check for specific card text.
    // The "Learn" and "Train" buttons are good indicators of a card.
    await expect(
      page.getByRole('button', { name: en.lectureCard.learn }),
    ).toHaveCount(0);
  });

  test('Show list of Lectures', async ({ page }) => {
    const mockLectures = [
      {
        id: '1',
        title: 'Introduction to Physics',
        description: 'Basic principles of motion and energy.',
        chapterCount: 3,
        questionCount: 12,
      },
      {
        id: '2',
        title: 'Advanced Chemistry',
        description: 'Organic compounds and reactions.',
        chapterCount: 5,
        questionCount: 24,
      },
      {
        id: '3',
        title: 'World History',
        description: 'Civilizations from ancient to modern times.',
        chapterCount: 7,
        questionCount: 30,
      },
    ];

    // Mock getLectures to return mock data
    await page.route('**/api/trpc/lectures.getLectures*', async (route) => {
      await route.fulfill({
        json: {
          result: {
            data: mockLectures,
          },
        },
      });
    });

    await page.goto('/');

    // Check headers are still there
    await expect(
      page.getByRole('heading', { name: en.overview.availableLectures }),
    ).toBeVisible();

    // Check for each lecture card
    for (const lecture of mockLectures) {
      await expect(page.getByText(lecture.title)).toBeVisible();
      await expect(page.getByText(lecture.description)).toBeVisible();

      // Check for Learn/Train buttons within the card context?
      // simple check: see if the buttons exist on the page
      // verify count of observable cards
    }

    // Verify correct number of "Train" buttons (one per card)
    await expect(
      page.getByRole('button', { name: en.lectureCard.train }),
    ).toHaveCount(mockLectures.length);

    // Verify the meta line (chapter/card counts) renders for the first lecture
    const meta = en.lectureCard.meta
      .replace('{{chapters}}', '3')
      .replace('{{cards}}', '12');
    await expect(page.getByText(meta)).toBeVisible();
  });

  test('Edit button navigates to edit page', async ({ page }) => {
    const mockLectures = [
      {
        id: 'test-lecture-1',
        title: 'Test Lecture',
        description: 'Test description',
        chapterCount: 2,
        questionCount: 8,
      },
    ];

    // Mock getLectures
    await page.route('**/api/trpc/lectures.getLectures*', async (route) => {
      await route.fulfill({
        json: {
          result: {
            data: mockLectures,
          },
        },
      });
    });

    await page.goto('/');

    // Wait for the lecture card to be visible
    await expect(page.getByText('Test Lecture')).toBeVisible();

    // Click the edit button
    const editButton = page.getByTestId('lecture-edit-button');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Verify navigation to edit page (app uses hash-based routing)
    await expect(page).toHaveURL(/#\/edit\/test-lecture-1/);
  });

  test('Delete button shows confirmation and deletes lecture', async ({
    page,
  }) => {
    const mockLectures = [
      {
        id: 'test-lecture-2',
        title: 'Lecture to Delete',
        description: 'This lecture will be deleted',
        chapterCount: 4,
        questionCount: 16,
      },
    ];

    // Mock getLectures
    await page.route('**/api/trpc/lectures.getLectures*', async (route) => {
      await route.fulfill({
        json: {
          result: {
            data: mockLectures,
          },
        },
      });
    });

    // Mock deleteLecture mutation
    let deleteWasCalled = false;
    await page.route('**/api/trpc/lectures.deleteLecture*', async (route) => {
      deleteWasCalled = true;
      await route.fulfill({
        json: {
          result: {
            data: { success: true },
          },
        },
      });
    });

    await page.goto('/');

    // Wait for the lecture card to be visible
    await expect(page.getByText('Lecture to Delete')).toBeVisible();

    // Set up dialog handler to accept the confirmation
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Lecture to Delete');
      await dialog.accept();
    });

    // Click the delete button
    const deleteButton = page.getByTestId('lecture-delete-button');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Wait for the mutation to be called
    await page.waitForTimeout(500);
    expect(deleteWasCalled).toBe(true);
  });
});
