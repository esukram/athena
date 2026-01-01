import { expect, test } from '@playwright/test';

test('add a new lecture', async ({ page }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lectures: any[] = [
    { id: '1', title: 'Existing Lecture', description: 'Desc' },
  ];

  // Mock getLectures
  // tRPC default response format: { result: { data: ... } }
  await page.route('**/api/trpc/lectures.getLectures*', async (route) => {
    await route.fulfill({
      json: {
        result: {
          data: lectures,
        },
      },
    });
  });

  // Mock createLecture
  await page.route('**/api/trpc/lectures.createLecture*', async (route) => {
    const postData = route.request().postDataJSON();

    const input = postData || {};
    const newLecture = {
      id: 'test-lecture-id-' + Date.now(),
      title: input.title || 'Untitled',
      description: input.description || 'No desc',
      ...input,
    };

    lectures.push(newLecture);

    await route.fulfill({
      json: {
        result: {
          data: newLecture,
        },
      },
    });
  });

  // Go to home page
  await page.goto('/');

  // Navigate to Add Lecture page via NavMenu
  await page.getByTestId('nav-menu-button').click();
  await page.getByTestId('nav-menu-add-lecture').click();

  // Verify we are on the add lecture page
  await expect(page).toHaveURL(/.*#\/add-lecture/);

  // Fill in the form
  const lectureTitle = 'Test Lecture ' + Date.now();
  await page.fill('input#title', lectureTitle);
  await page.fill(
    'textarea#description',
    'This is a test lecture description.',
  );

  // Submit
  await page.click('button[type="submit"]');

  // Verify we are redirected to home
  await expect(page).toHaveURL(/.*#\//);

  // Verify the new lecture is visible
  await expect(page.getByText(lectureTitle).first()).toBeVisible();
});
