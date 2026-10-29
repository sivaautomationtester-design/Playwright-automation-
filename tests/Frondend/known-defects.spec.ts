import { env, users } from '../../src/config/env';
import { expect, test } from '../../src/fixtures';

// SauceDemo ships deliberate bugs for some demo users. These tests assert the correct
// behaviour and are marked test.fail(), documenting the defect while keeping the suite green.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Known UI defects @defect', () => {
  test('problem_user: every product should show its own image', async ({ loginPage, inventoryPage }) => {
    test.fail(true, 'DEFECT: problem_user sees the same image for every product');
    await loginPage.goto();
    await loginPage.login(users.problem, env.uiPassword);
    await expect(inventoryPage.items.first()).toBeVisible();

    const sources = await inventoryPage.itemImages.evaluateAll((imgs) =>
      imgs.map((img) => (img as HTMLImageElement).getAttribute('src')),
    );
    expect(new Set(sources).size).toBe(sources.length);
  });
});
