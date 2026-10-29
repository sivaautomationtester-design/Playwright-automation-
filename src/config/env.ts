// All environment settings in one place. Defaults point at the public demo sites and their
// published demo credentials, so the suite runs with zero setup. Override with environment variables.
export const env = {
  apiBaseUrl: process.env.API_BASE_URL ?? 'https://restful-booker.herokuapp.com',
  apiUsername: process.env.API_USERNAME ?? 'admin',
  apiPassword: process.env.API_PASSWORD ?? 'password123',

  uiBaseUrl: process.env.UI_BASE_URL ?? 'https://www.saucedemo.com',
  uiPassword: process.env.UI_PASSWORD ?? 'secret_sauce',
};

export const users = {
  standard: 'standard_user',
  lockedOut: 'locked_out_user',
  problem: 'problem_user',
} as const;

/** Where the UI setup project saves the logged-in session (git-ignored). */
export const STORAGE_STATE = 'playwright/.auth/standard_user.json';
