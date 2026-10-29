import { test as setup, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { env, STORAGE_STATE, users } from '../../src/config/env';
import { LoginPage } from '../../src/pages/LoginPage';

// Runs once before the UI projects: logs in through the UI and saves the session,
// so every other UI test starts already logged in (faster and less flaky).
setup('log in as standard user', async ({ page }) => {
  await allure.parentSuite('UI Tests');
  await allure.label('project', 'UI Tests');
  const login = new LoginPage(page);
  await login.goto();
  await login.login(users.standard, env.uiPassword);
  await expect(page).toHaveURL(/inventory\.html/);
  await page.context().storageState({ path: STORAGE_STATE });
});
