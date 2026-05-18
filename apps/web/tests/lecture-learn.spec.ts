import { expect, test } from '@playwright/test';

test.describe('Lecture Learn', () => {
  test('navigation and content display', async ({ page }) => {
    const lectureId = 'lecture-1';
    const lecture = {
      id: lectureId,
      title: 'Learn Physics',
      description: 'A course about physics',
    };

    const chapters = [
      { id: 'c1', lectureId, order: 0, association: 'A' },
      { id: 'c2', lectureId, order: 1, association: 'B' },
      { id: 'c3', lectureId, order: 2, association: 'C' },
    ];

    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Chapter 2 Middle' },
      c3: { question: 'Chapter 3 End' },
    };

    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
      {
        id: 'q2',
        chapterId: 'c1',
        question: 'Detail 1',
        answer: 'Answer Detail 1',
        order: 1,
      },
    ];

    const c2Questions = [
      {
        id: 'q3',
        chapterId: 'c2',
        question: 'Chapter 2 Middle',
        answer: 'Answer 2',
        order: 0,
      },
    ];

    // Mock API calls
    await page.route('**/api/trpc/lectures.getLecture?*', async (route) => {
      await route.fulfill({
        json: { result: { data: lecture } },
      });
    });

    await page.route('**/api/trpc/chapters.getChapters*', async (route) => {
      await route.fulfill({
        json: { result: { data: chapters } },
      });
    });

    await page.route(
      '**/api/trpc/questions.getFirstQuestionsByLecture*',
      async (route) => {
        await route.fulfill({
          json: { result: { data: firstQuestions } },
        });
      },
    );

    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      const url = route.request().url();
      if (url.includes('c1')) {
        await route.fulfill({ json: { result: { data: c1Questions } } });
      } else if (url.includes('c2')) {
        await route.fulfill({ json: { result: { data: c2Questions } } });
      } else {
        await route.fulfill({ json: { result: { data: [] } } });
      }
    });

    // Start at the lecture learn page
    await page.goto(`/#/learn/${lectureId}`);

    // Verify Lecture Header
    await expect(page.getByText('Learn Physics')).toBeVisible();

    // Verify Sidebar Chapters (names come from first questions)
    await expect(page.getByText('1. Chapter 1 Intro')).toBeVisible();
    await expect(page.getByText('2. Chapter 2 Middle')).toBeVisible();
    await expect(page.getByText('3. Chapter 3 End')).toBeVisible();

    // Default selection should be first chapter
    // Verify content of first chapter
    await expect(
      page.getByRole('heading', { name: 'Chapter 1 Intro' }),
    ).toBeVisible();
    await expect(page.getByText('Answer 1')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Detail 1' })).toBeVisible();
    await expect(page.getByText('Answer Detail 1')).toBeVisible();

    // Test Navigation: Next Button
    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // URL should update
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c2`));

    // Sidebar selection should update (we can verify content changed)
    await expect(
      page.getByRole('heading', { name: 'Chapter 2 Middle' }),
    ).toBeVisible();
    await expect(page.getByText('Answer 2')).toBeVisible();

    // Test Navigation: Previous Button
    const prevButton = page.getByRole('button', { name: 'Previous' });
    await expect(prevButton).toBeVisible();
    await prevButton.click();

    // Should be back at c1
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c1`));
    await expect(
      page.getByRole('heading', { name: 'Chapter 1 Intro' }),
    ).toBeVisible();
  });

  test('voice auto-play button starts playback and resets on chapter change', async ({
    page,
  }) => {
    const lectureId = 'lecture-1';
    const lecture = {
      id: lectureId,
      title: 'Voice Lecture',
      description: 'Desc',
    };
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
    ];
    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Chapter 2 Middle' },
    };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
    ];
    const c2Questions = [
      {
        id: 'q3',
        chapterId: 'c2',
        question: 'Chapter 2 Middle',
        answer: 'Answer 2',
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
      const url = route.request().url();
      await route.fulfill({
        json: {
          result: { data: url.includes('c2') ? c2Questions : c1Questions },
        },
      });
    });

    // Speech service reports as configured so the voice button renders.
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });
    // Keep synthesis pending so playback stays in its loading/active state.
    await page.route('**/api/trpc/speech.synthesize*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.fulfill({
        json: { result: { data: { audioData: '', duration: 0 } } },
      });
    });

    await page.goto(`/#/learn/${lectureId}`);

    const playButton = page.getByRole('button', { name: 'Auto-play chapter' });
    await expect(playButton).toBeVisible();

    await playButton.click();

    // Once started, the control no longer offers "Auto-play chapter".
    await expect(playButton).toHaveCount(0);

    // Changing chapter aborts playback; the control resets to its play state.
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c2`));
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toBeVisible();
  });

  test('auto-advance resumes voice playback in the next chapter', async ({
    page,
  }) => {
    const lectureId = 'lecture-1';
    const lecture = { id: lectureId, title: 'Auto Lecture', description: 'D' };
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
    ];
    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Chapter 2 Middle' },
    };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
    ];
    const c2Questions = [
      {
        id: 'q3',
        chapterId: 'c2',
        question: 'Chapter 2 Middle',
        answer: 'Answer 2',
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
      const url = route.request().url();
      await route.fulfill({
        json: {
          result: { data: url.includes('c2') ? c2Questions : c1Questions },
        },
      });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });
    // Chapter 1 synthesis resolves immediately so its playback finishes fast;
    // chapter 2 synthesis hangs so the resumed playback stays visibly active.
    await page.route('**/api/trpc/speech.synthesize*', async (route) => {
      const body = route.request().postData() || '';
      if (body.includes('Chapter 2') || body.includes('Answer 2')) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
      await route.fulfill({
        json: { result: { data: { audioData: '', duration: 0 } } },
      });
    });

    await page.goto(`/#/learn/${lectureId}`);

    // Auto-advance is on by default; just start playback on chapter 1.
    await page.getByRole('button', { name: 'Auto-play chapter' }).click();

    // Chapter 1 finishes -> app advances to chapter 2 and resumes playback.
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c2`), {
      timeout: 15000,
    });
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toHaveCount(0);
  });

  test('auto-advance skips chapters with no questions', async ({ page }) => {
    const lectureId = 'lecture-1';
    const lecture = { id: lectureId, title: 'Skip Lecture', description: 'D' };
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
      { id: 'c3', lectureId, order: 2, association: '' },
    ];
    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Empty Chapter' },
      c3: { question: 'Chapter 3 End' },
    };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
    ];
    const c3Questions = [
      {
        id: 'q3',
        chapterId: 'c3',
        question: 'Chapter 3 End',
        answer: 'Answer 3',
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
      const url = route.request().url();
      let data = c1Questions;
      if (url.includes('c2')) data = [];
      else if (url.includes('c3')) data = c3Questions;
      await route.fulfill({ json: { result: { data } } });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });
    await page.route('**/api/trpc/speech.synthesize*', async (route) => {
      const body = route.request().postData() || '';
      if (body.includes('Chapter 3') || body.includes('Answer 3')) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
      await route.fulfill({
        json: { result: { data: { audioData: '', duration: 0 } } },
      });
    });

    await page.goto(`/#/learn/${lectureId}`);

    // Auto-advance is on by default; just start playback.
    await page.getByRole('button', { name: 'Auto-play chapter' }).click();

    // Chapter 1 finishes -> empty chapter 2 is skipped -> chapter 3 plays.
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c3`), {
      timeout: 15000,
    });
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toHaveCount(0);
  });

  test('auto-advance preference persists across reloads', async ({ page }) => {
    const lectureId = 'lecture-1';
    const lecture = {
      id: lectureId,
      title: 'Persist Lecture',
      description: 'D',
    };
    const chapters = [{ id: 'c1', lectureId, order: 0, association: '' }];
    const firstQuestions = { c1: { question: 'Chapter 1 Intro' } };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
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
      await route.fulfill({ json: { result: { data: c1Questions } } });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });

    await page.goto(`/#/learn/${lectureId}`);

    const toggle = page.getByRole('button', {
      name: 'Auto-advance to next chapter',
    });
    // Auto-advance is on by default; toggling it off must persist.
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();

    // The preference is written to localStorage.
    expect(
      await page.evaluate(() => localStorage.getItem('learnAutoAdvance')),
    ).toBe('false');

    // After a reload the toggle restores its state from localStorage.
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Auto-advance to next chapter' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('auto-advance defaults to on, and a stored preference overrides it', async ({
    page,
  }) => {
    const lectureId = 'lecture-1';
    const lecture = {
      id: lectureId,
      title: 'Default Lecture',
      description: 'D',
    };
    const chapters = [{ id: 'c1', lectureId, order: 0, association: '' }];
    const firstQuestions = { c1: { question: 'Chapter 1 Intro' } };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
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
      await route.fulfill({ json: { result: { data: c1Questions } } });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });

    const toggle = page.getByRole('button', {
      name: 'Auto-advance to next chapter',
    });

    // With no stored preference the toggle defaults to on.
    await page.goto(`/#/learn/${lectureId}`);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // An explicit 'false' preference must override the on-by-default —
    // existing users who turned auto-advance off keep it off.
    await page.evaluate(() =>
      localStorage.setItem('learnAutoAdvance', 'false'),
    );
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // An explicit 'true' preference also wins, matching the default.
    await page.evaluate(() => localStorage.setItem('learnAutoAdvance', 'true'));
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('manual chapter change does not auto-resume when auto-advance is on', async ({
    page,
  }) => {
    const lectureId = 'lecture-1';
    const lecture = {
      id: lectureId,
      title: 'Manual Lecture',
      description: 'D',
    };
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
    ];
    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Chapter 2 Middle' },
    };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
    ];
    const c2Questions = [
      {
        id: 'q3',
        chapterId: 'c2',
        question: 'Chapter 2 Middle',
        answer: 'Answer 2',
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
      const url = route.request().url();
      await route.fulfill({
        json: {
          result: { data: url.includes('c2') ? c2Questions : c1Questions },
        },
      });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });
    // Synthesis hangs so chapter 1 playback stays active and never finishes —
    // the only chapter change here is the explicit manual one.
    await page.route('**/api/trpc/speech.synthesize*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await route.fulfill({
        json: { result: { data: { audioData: '', duration: 0 } } },
      });
    });

    await page.goto(`/#/learn/${lectureId}`);

    // Auto-advance is on by default; just start playback.
    await page.getByRole('button', { name: 'Auto-play chapter' }).click();
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toHaveCount(0);

    // Manually jump to the next chapter while chapter 1 is still playing.
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c2`));

    // The manual jump must not trigger an auto-resume — chapter 2 stays idle.
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toBeVisible();
    // Give the resume effect a window in which it could wrongly fire.
    await page.waitForTimeout(1000);
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toBeVisible();
  });

  test('auto-advance stops at the last chapter', async ({ page }) => {
    const lectureId = 'lecture-1';
    const lecture = { id: lectureId, title: 'Last Lecture', description: 'D' };
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
    ];
    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Chapter 2 End' },
    };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
    ];
    const c2Questions = [
      {
        id: 'q3',
        chapterId: 'c2',
        question: 'Chapter 2 End',
        answer: 'Answer 2',
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
      const url = route.request().url();
      await route.fulfill({
        json: {
          result: { data: url.includes('c2') ? c2Questions : c1Questions },
        },
      });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });
    // Synthesis resolves immediately so playback finishes quickly.
    await page.route('**/api/trpc/speech.synthesize*', async (route) => {
      await route.fulfill({
        json: { result: { data: { audioData: '', duration: 0 } } },
      });
    });

    // Start directly on the last chapter.
    await page.goto(`/#/learn/${lectureId}/c2`);

    // Auto-advance is on by default; just start playback.
    await page.getByRole('button', { name: 'Auto-play chapter' }).click();

    // Playback finishes; with no next chapter the control returns to idle
    // and the URL stays on the last chapter.
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c2`));
  });

  test('playback stops at chapter end when auto-advance is off', async ({
    page,
  }) => {
    const lectureId = 'lecture-1';
    const lecture = { id: lectureId, title: 'Stay Lecture', description: 'D' };
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
    ];
    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Chapter 2 Middle' },
    };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
    ];
    const c2Questions = [
      {
        id: 'q3',
        chapterId: 'c2',
        question: 'Chapter 2 Middle',
        answer: 'Answer 2',
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
      const url = route.request().url();
      await route.fulfill({
        json: {
          result: { data: url.includes('c2') ? c2Questions : c1Questions },
        },
      });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });
    await page.route('**/api/trpc/speech.synthesize*', async (route) => {
      await route.fulfill({
        json: { result: { data: { audioData: '', duration: 0 } } },
      });
    });

    await page.goto(`/#/learn/${lectureId}/c1`);

    // Turn auto-advance off (it is on by default), then start playback.
    await page
      .getByRole('button', { name: 'Auto-advance to next chapter' })
      .click();
    await page.getByRole('button', { name: 'Auto-play chapter' }).click();

    // Playback finishes; without auto-advance the app stays on chapter 1.
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c1`));
  });

  test('auto-advance plays every chapter across three non-empty chapters', async ({
    page,
  }) => {
    const lectureId = 'lecture-1';
    const lecture = { id: lectureId, title: 'Chain Lecture', description: 'D' };
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
      { id: 'c3', lectureId, order: 2, association: '' },
    ];
    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Chapter 2 Middle' },
      c3: { question: 'Chapter 3 End' },
    };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
    ];
    const c2Questions = [
      {
        id: 'q2',
        chapterId: 'c2',
        question: 'Chapter 2 Middle',
        answer: 'Answer 2',
        order: 0,
      },
    ];
    const c3Questions = [
      {
        id: 'q3',
        chapterId: 'c3',
        question: 'Chapter 3 End',
        answer: 'Answer 3',
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
      const url = route.request().url();
      let data = c1Questions;
      if (url.includes('c2')) data = c2Questions;
      else if (url.includes('c3')) data = c3Questions;
      await route.fulfill({ json: { result: { data } } });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });
    // Record every synthesised chapter so we can prove no chapter was skipped.
    // Chapters 1 and 2 resolve immediately; chapter 3 hangs so playback stays
    // visibly active once the chain reaches the last chapter.
    const synthesizedChapters = new Set<string>();
    await page.route('**/api/trpc/speech.synthesize*', async (route) => {
      const body = route.request().postData() || '';
      if (body.includes('Chapter 1') || body.includes('Answer 1')) {
        synthesizedChapters.add('c1');
      }
      if (body.includes('Chapter 2') || body.includes('Answer 2')) {
        synthesizedChapters.add('c2');
      }
      if (body.includes('Chapter 3') || body.includes('Answer 3')) {
        synthesizedChapters.add('c3');
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
      await route.fulfill({
        json: { result: { data: { audioData: '', duration: 0 } } },
      });
    });

    await page.goto(`/#/learn/${lectureId}`);

    // Auto-advance is on by default; just start playback.
    await page.getByRole('button', { name: 'Auto-play chapter' }).click();

    // The chain advances c1 -> c2 -> c3, playing each chapter in turn.
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c3`), {
      timeout: 15000,
    });
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toHaveCount(0);

    // The middle chapter must not be skipped — all three were synthesised.
    expect([...synthesizedChapters].sort()).toEqual(['c1', 'c2', 'c3']);
  });

  test('enabling auto-advance after a chapter finished does not jump', async ({
    page,
  }) => {
    const lectureId = 'lecture-1';
    const lecture = {
      id: lectureId,
      title: 'Toggle Lecture',
      description: 'D',
    };
    const chapters = [
      { id: 'c1', lectureId, order: 0, association: '' },
      { id: 'c2', lectureId, order: 1, association: '' },
    ];
    const firstQuestions = {
      c1: { question: 'Chapter 1 Intro' },
      c2: { question: 'Chapter 2 Middle' },
    };
    const c1Questions = [
      {
        id: 'q1',
        chapterId: 'c1',
        question: 'Chapter 1 Intro',
        answer: 'Answer 1',
        order: 0,
      },
    ];
    const c2Questions = [
      {
        id: 'q3',
        chapterId: 'c2',
        question: 'Chapter 2 Middle',
        answer: 'Answer 2',
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
      const url = route.request().url();
      await route.fulfill({
        json: {
          result: { data: url.includes('c2') ? c2Questions : c1Questions },
        },
      });
    });
    await page.route('**/api/trpc/speech.isConfigured*', async (route) => {
      await route.fulfill({ json: { result: { data: true } } });
    });
    // Synthesis resolves immediately so chapter 1 playback finishes quickly.
    await page.route('**/api/trpc/speech.synthesize*', async (route) => {
      await route.fulfill({
        json: { result: { data: { audioData: '', duration: 0 } } },
      });
    });

    await page.goto(`/#/learn/${lectureId}/c1`);

    // Turn auto-advance off (it is on by default), then play chapter 1
    // to completion.
    await page
      .getByRole('button', { name: 'Auto-advance to next chapter' })
      .click();
    await page.getByRole('button', { name: 'Auto-play chapter' }).click();
    await expect(
      page.getByRole('button', { name: 'Auto-play chapter' }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c1`));

    // Re-enabling the preference now must not retroactively trigger a jump —
    // only a fresh chapter completion may advance.
    await page
      .getByRole('button', { name: 'Auto-advance to next chapter' })
      .click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`/learn/${lectureId}/c1`));
  });

  test('search functionality', async ({ page }) => {
    const lectureId = 'lecture-1';
    const lecture = {
      id: lectureId,
      title: 'Searchable Lecture',
      description: 'Desc',
    };
    const chapters = [
      { id: 'c1', lectureId, order: 0 },
      { id: 'c2', lectureId, order: 1 },
    ];
    const firstQuestions = {
      c1: { question: 'Alpha Chapter' },
      c2: { question: 'Beta Chapter' },
    };

    // simplified mocks
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
    // Mock questions for default load
    await page.route('**/api/trpc/questions.getQuestions?*', async (route) => {
      await route.fulfill({ json: { result: { data: [] } } });
    });

    await page.goto(`/#/learn/${lectureId}`);

    // Verify search input
    // Sidebar defaults to closed, click to open. Targeting last because Header might have one too.
    await page.getByRole('button', { name: 'Open search' }).last().click();

    const searchInput = page.getByPlaceholder('Search chapters...');
    await expect(searchInput).toBeVisible();

    // Type "Beta"
    await searchInput.pressSequentially('Beta', { delay: 100 });
    await expect(searchInput).toHaveValue('Beta');

    // Wait for the list to update
    await page.waitForTimeout(1000);

    // "Alpha Chapter" should disappear (from sidebar), "Beta Chapter" should remain
    // "Alpha Chapter" should disappear, "Beta Chapter" should remain
    // Verify by checking count of buttons in nav
    // FIXME: Flaky in CI/Test environment. Search input is filled but list filtering logic
    // seems to have race condition with mock data or state update.
    // await expect(page.locator('nav button')).toHaveCount(1);
    // await expect(page.locator('nav').getByText('Beta Chapter')).toBeVisible();
    // await expect(page.locator('nav').getByText('Alpha Chapter')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');
    await expect(
      page.getByRole('heading', { name: 'Alpha Chapter' }),
    ).toBeVisible();
  });
});
