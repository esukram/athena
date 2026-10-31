import { expect, test } from '@playwright/test';

// jsdom has no layout or CSS transitions, so the toast's fade can only be
// checked in a real browser (#296).
test('toast fades in, fades out, then unmounts', async ({ page }) => {
  await page.route('**/api/trpc/lectures.getLectures*', async (route) => {
    await route.fulfill({
      json: {
        result: {
          data: [
            {
              id: 'a',
              title: 'Lecture A',
              description: '',
              chapterCount: 0,
              questionCount: 0,
            },
            {
              id: 'b',
              title: 'Lecture B',
              description: '',
              chapterCount: 0,
              questionCount: 0,
            },
          ],
        },
      },
    });
  });
  await page.route('**/api/trpc/lectures.reorderLecture*', async (route) => {
    await route.fulfill({
      status: 500,
      json: { error: { json: { message: 'boom', code: -32603 } } },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Reorder Lecture A' }).focus();

  // Record the toast's computed opacity every frame until it leaves the DOM.
  // Wrapped in an object so the handle resolves once the sampler is running,
  // not when it finishes; only then trigger the toast.
  const sampler = await page.evaluateHandle(() => ({
    done: new Promise<number[]>((resolve) => {
      const opacities: number[] = [];
      const tick = () => {
        const toast = document.querySelector('[role="alert"]');
        if (toast) {
          opacities.push(Number(getComputedStyle(toast).opacity));
        } else if (opacities.length > 0) {
          resolve(opacities);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    }),
  }));
  await page.keyboard.press('Alt+ArrowDown');

  const opacities = await sampler.evaluate((s) => s.done);
  const peak = opacities.indexOf(1);
  const between = (o: number) => o > 0 && o < 1;

  expect(peak).toBeGreaterThan(0);
  expect(opacities.slice(0, peak).some(between)).toBe(true); // fade-in
  expect(opacities.slice(peak).some(between)).toBe(true); // fade-out
});
