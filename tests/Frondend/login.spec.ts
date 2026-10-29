import { env, users } from '../../src/config/env';
import { expect, test } from '../../src/fixtures';

// These tests exercise the login form itself, so start logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('standard user can log in', async ({ loginPage, inventoryPage, page }) => {
    await loginPage.login(users.standard, env.uiPassword);
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(inventoryPage.title).toHaveText('Products');
  });

  const invalid = [
    { case: 'locked-out user', user: users.lockedOut, pass: env.uiPassword, error: 'locked out' },
    { case: 'wrong password', user: users.standard, pass: 'wrong', error: 'do not match any user' },
    { case: 'empty username', user: '', pass: env.uiPassword, error: 'Username is required' },
    { case: 'empty password', user: users.standard, pass: '', error: 'Password is required' },
  ];
  for (const { case: name, user, pass, error } of invalid) {
    test(`${name} is rejected with a clear message`, async ({ loginPage, page }) => {
      await loginPage.login(user, pass);
      await expect(loginPage.error).toContainText(error);
      await expect(page).not.toHaveURL(/inventory\.html/);
    });
  }

  test('protected pages redirect to login when logged out', async ({ page, loginPage }) => {
    await page.goto('/inventory.html');
    await expect(loginPage.loginButton).toBeVisible();
  });
});
