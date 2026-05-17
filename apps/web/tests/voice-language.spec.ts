import { type Page, expect, test } from '@playwright/test';

/**
 * Covers that the language picker is the single source of truth for the
 * text-to-speech voice: whatever the picker resolves to is the `language`
 * sent to `speech.synthesize`. The regional-locale cases guard the regression
 * where a code like `en-GB`/`de-AT` failed the picker's exact-match lookup.
 */

const lectureId = 'lecture-1';
const lecture = { id: lectureId, title: 'Voice Lecture', description: 'Desc' };
const chapters = [{ id: 'c1', lectureId, order: 0, association: '' }];
const firstQuestions = { c1: { question: 'Q1' } };
const c1Questions = [
  { id: 'q1', chapterId: 'c1', question: 'Q1', answer: 'A1', order: 0 },
];

// Accessible name of the auto-play button is translated; match either locale.
const autoPlayButton = /Auto-play chapter|Kapitel automatisch vorlesen/;

async function mockLearnApi(page: Page): Promise<void> {
  await page.route('**/api/trpc/lectures.getLecture?*', (route) =>
    route.fulfill({ json: { result: { data: lecture } } }),
  );
  await page.route('**/api/trpc/chapters.getChapters*', (route) =>
    route.fulfill({ json: { result: { data: chapters } } }),
  );
  await page.route(
    '**/api/trpc/questions.getFirstQuestionsByLecture*',
    (route) => route.fulfill({ json: { result: { data: firstQuestions } } }),
  );
  await page.route('**/api/trpc/questions.getQuestions?*', (route) =>
    route.fulfill({ json: { result: { data: c1Questions } } }),
  );
  // Speech reports as configured so the auto-play control renders.
  await page.route('**/api/trpc/speech.isConfigured*', (route) =>
    route.fulfill({ json: { result: { data: true } } }),
  );
}

/**
 * Records the `language` of every `speech.synthesize` call and answers each
 * with empty audio so playback can proceed without a real speech backend.
 */
async function trackSynthesisLanguages(page: Page): Promise<string[]> {
  const languages: string[] = [];
  await page.route('**/api/trpc/speech.synthesize*', async (route) => {
    const match = (route.request().postData() ?? '').match(
      /"language":"(de|en)"/,
    );
    if (match) languages.push(match[1]);
    await route.fulfill({
      json: { result: { data: { audioData: '', duration: 0 } } },
    });
  });
  return languages;
}

test.describe('Voice language', () => {
  test('picking German in the picker makes the voice use the German locale', async ({
    page,
  }) => {
    await mockLearnApi(page);
    const languages = await trackSynthesisLanguages(page);

    await page.goto(`/#/learn/${lectureId}`);

    await page.getByRole('button', { name: 'Select language' }).click();
    await page.getByRole('option', { name: 'Deutsch' }).click();

    await page.getByRole('button', { name: autoPlayButton }).click();

    await expect.poll(() => languages[0]).toBe('de');
  });

  test('picking English in the picker makes the voice use the English locale', async ({
    page,
  }) => {
    await mockLearnApi(page);
    const languages = await trackSynthesisLanguages(page);

    await page.goto(`/#/learn/${lectureId}`);

    await page.getByRole('button', { name: 'Select language' }).click();
    await page.getByRole('option', { name: 'English' }).click();

    await page.getByRole('button', { name: autoPlayButton }).click();

    await expect.poll(() => languages[0]).toBe('en');
  });

  // Regional browser locales must resolve to a supported language for both
  // the picker display and the synthesized voice — not silently fall back.
  test.describe('regional browser locale en-GB', () => {
    test.use({ locale: 'en-GB' });

    test('resolves to English in the picker and the voice', async ({
      page,
    }) => {
      await mockLearnApi(page);
      const languages = await trackSynthesisLanguages(page);

      await page.goto(`/#/learn/${lectureId}`);

      const picker = page.getByRole('button', { name: 'Select language' });
      await picker.click();
      await expect(
        page.getByRole('option', { name: 'English' }),
      ).toHaveAttribute('aria-selected', 'true');
      await picker.click(); // close the menu

      await page.getByRole('button', { name: autoPlayButton }).click();

      await expect.poll(() => languages[0]).toBe('en');
    });
  });

  test.describe('regional browser locale de-AT', () => {
    test.use({ locale: 'de-AT' });

    test('resolves to German in the picker and the voice', async ({ page }) => {
      await mockLearnApi(page);
      const languages = await trackSynthesisLanguages(page);

      await page.goto(`/#/learn/${lectureId}`);

      const picker = page.getByRole('button', { name: 'Select language' });
      await picker.click();
      await expect(
        page.getByRole('option', { name: 'Deutsch' }),
      ).toHaveAttribute('aria-selected', 'true');
      await picker.click(); // close the menu

      await page.getByRole('button', { name: autoPlayButton }).click();

      await expect.poll(() => languages[0]).toBe('de');
    });
  });
});
