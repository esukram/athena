import { expect, test } from '@playwright/test';

test.describe('New Chapter Save Bug', () => {
  const lectureId = 'lecture-new-chapter-bug-1';

  test('does not duplicate new chapter when adding a second question and saving', async ({ page }) => {
    // Setup: Mock lecture data
    const lecture = {
      id: lectureId,
      title: 'Test Lecture',
      description: 'Test Description',
    };
    
    // Initial state with no chapters

    // Mock API routes
    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({ json: { result: { data: lecture } } });
    });
    
    // Setup chapter get mock that returns empty first, then contains the new chapter once created
    let chapterCreated = false;
    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      if (chapterCreated) {
        await route.fulfill({ json: { result: { data: [{ id: 'new-chapter-id', lectureId, order: 0, association: '' }] } } });
      } else {
        await route.fulfill({ json: { result: { data: [] } } });
      }
    });

    await page.route('**/api/trpc/chapters.getDistinctAssociations*', async (route) => {
        await route.fulfill({ json: { result: { data: [] } } });
    });

    await page.route('**/api/trpc/questions.getFirstQuestionsByLecture*', async (route) => {
      if (chapterCreated) {
        await route.fulfill({ json: { result: { data: { 'new-chapter-id': { question: 'First Question', answer: 'First Answer', order: 0 } } } } });
      } else {
        await route.fulfill({ json: { result: { data: {} } } });
      }
    });

    // Track createChapter calls
    let createChapterCallCount = 0;
    await page.route('**/api/trpc/chapters.createChapter*', async (route) => {
      createChapterCallCount++;
      chapterCreated = true;
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

    // Track createQuestion calls
    let createQuestionCallCount = 0;
    await page.route('**/api/trpc/questions.createQuestion*', async (route) => {
      createQuestionCallCount++;
      const postData = route.request().postDataJSON();
      
      if (!postData.chapterId) {
        return route.fulfill({
          status: 500,
          json: {
            error: { json: { message: 'FOREIGN KEY constraint failed', code: -32603 } },
          },
        });
      }

      await route.fulfill({
        json: {
          result: {
            data: { id: `new-q-id-${createQuestionCallCount}`, ...postData },
          },
        },
      });
    });
    
    // Mock updateQuestion (might be called if editing questions, though we are adding new ones)
    await page.route('**/api/trpc/questions.updateQuestion*', async (route) => {
      await route.fulfill({
        json: { result: { data: { success: true } } },
      });
    });
    
    await page.route('**/api/trpc/questions.getQuestions*', async (route) => {
      await route.fulfill({ json: { result: { data: [] } } });
    });

    // 1. Navigate to edit page
    await page.goto(`/#/edit/${lectureId}`);

    // 2. Add a new chapter with initial question text
    const newChapterInput = page.getByPlaceholder('New chapter question');
    await newChapterInput.fill('First Question');
    await page.getByRole('button', { name: 'Add' }).click();

    // Modal should open with pre-populated question
    await expect(page.getByRole('heading', { name: 'Edit Chapter' })).toBeVisible();

    // Fill the answer for the first question
    await page.getByPlaceholder('Write your answer in Markdown...').first().fill('First Answer');

    // 3. Click Add Question - this triggers auto-save for the new chapter
    await page.getByRole('button', { name: 'Add Question' }).click();

    // Wait for auto-save to complete
    await page.waitForTimeout(500);
    await expect(page.getByRole('status')).toBeVisible(); // Saved toast
    
    // Fill the second question
    await page.getByPlaceholder('Enter question').last().fill('Second Question');
    await page.getByPlaceholder('Write your answer in Markdown...').last().fill('Second Answer');

    // 4. Click Save
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    
    // Modal should close
    await expect(page.getByRole('heading', { name: 'Edit Chapter' })).not.toBeVisible();

    // 5. Verify chapter was only created ONCE
    expect(createChapterCallCount).toBe(1);
    
    // We should have created exactly 2 questions 
    // Wait for network requests to settle
    await page.waitForTimeout(500);
    // 1 during auto-save, 1 during manual save
    expect(createQuestionCallCount).toBe(2);
  });
});
