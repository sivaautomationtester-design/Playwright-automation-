# Playwright + TypeScript Test Framework

![Playwright tests](https://github.com/[YOUR-USERNAME]/playwright-typescript-framework/actions/workflows/playwright.yml/badge.svg)

API and UI test automation in one framework, built with Playwright and TypeScript.

- **API tests** run against [Restful-Booker](https://restful-booker.herokuapp.com), a public booking API made for test practice.
- **UI tests** run against [SauceDemo](https://www.saucedemo.com), a public demo shop, in Chromium, Firefox and WebKit.

## What it covers

| Area | Tests | Highlights |
|---|---|---|
| API: lifecycle | 3 | Health, auth, and one booking taken through create → read → search → PUT → PATCH → delete, verifying the data at every step |
| API: negative | 8 | PUT, PATCH and DELETE with no token and with a fake token are all rejected *and* leave the data unchanged; 404s; empty searches |
| API: known defects | 3 | Real Restful-Booker bugs, documented with `test.fail()` |
| UI: login | 6 | Valid login, locked-out user, wrong password, empty fields, redirect when logged out |
| UI: cart | 3 | Badge count, cart contents, cart survives reload |
| UI: sorting | 4 | Name A–Z / Z–A, price low–high / high–low, checked against the sorted data |
| UI: checkout | 4 | Full order with item total, 8% tax and grand total checked; required-field validation |
| UI: known defects | 1 | `problem_user` sees the same image for every product |

UI tests run in 3 browsers, so a full run executes about 70 tests (14 API + 18 UI × 3 browsers + 1 login setup).

## Framework design

```
src/
  api/BookingClient.ts      typed API client (one method per endpoint)
  api/types.ts              request and response types
  config/env.ts             URLs, credentials, users: one place, overridable by env vars
  data/bookingFactory.ts    builds unique, valid test data for every test
  fixtures/index.ts         custom fixtures: API client, token, ready-made booking, page objects
  pages/                    Page Object Model for login, inventory, cart and checkout
  reporters/MenuReporter.ts interactive HTML report grouped by API/UI test category
tests/
  api/                      API specs
  ui/                       UI specs + auth.setup.ts
```

- **Page Object Model:** locators and actions live in `src/pages`, so tests read like user stories.
- **Fixtures:** tests ask for what they need (`booking`, `token`, `inventoryPage`). A `booking` is created before the test and deleted after it, even if the test fails.
- **Log in once:** a setup project logs in through the UI and saves the session. Every other UI test starts already logged in, which is faster and less flaky. Login tests opt out and start logged out.
- **Data-driven tests:** invalid logins, unauthorised write operations and checkout validation are each a table of cases that runs as separate tests.
- **Independent tests:** every test creates its own data, so the suite runs fully in parallel.
- **Resilient locators:** roles, placeholders and test IDs instead of brittle XPath.
- **Debugging:** traces, screenshots and videos are kept for every failure.
- **Known defects:** bugs are asserted the correct way and marked `test.fail()`. The suite stays green, and if a bug is fixed, Playwright flags that the test unexpectedly passed.

## How to run

```bash
npm install
npx playwright install      # download browsers (first time only)

npm test                    # everything: API + UI in 3 browsers
npm run test:api            # API tests only
npm run test:chromium       # UI tests in Chromium only
npm run test:headed         # watch the UI tests run in a visible browser
npm run report              # open the last HTML report
npm run typecheck           # TypeScript check
npm run allure:generate     # build the Allure report from the latest test run
npm run allure:open         # open the generated Allure report
```

The npm test commands clear old Allure results before each run and write fresh results to
`allure-results/`. The built-in Playwright report is written to `playwright-report/`.
The custom interactive menu report is written to `menu-report/index.html` during the run
and organizes results under API and UI test categories. Open that file in a browser to
review status counts, failures, steps, logs, and screenshots. The Allure report is titled
**Playwright TypeScript Framework** and also groups tests under **API Tests** and **UI Tests**.
Generate it after running tests, then open it with `npm run allure:open`. The Allure
command-line report generator requires Java to be installed and available on your `PATH`.

No configuration is needed. The defaults are the public demo sites and their published demo credentials. To point at another environment, copy `.env.example` and set the variables in your shell or CI.

## CI

`.github/workflows/playwright.yml` runs on every push, every pull request and daily. It type-checks the code, runs all tests in all browsers, and uploads the HTML report as a build artifact.

## Findings

| # | System | Defect | Expected | Actual |
|---|---|---|---|---|
| 1 | API | Wrong password accepted at HTTP level | `401 Unauthorized` | `200 OK` with `{"reason":"Bad credentials"}` |
| 2 | API | Missing required fields cause a server error | `400 Bad Request` | `500 Internal Server Error` |
| 3 | API | Booking with checkout before checkin is saved | `400 Bad Request` | `200 OK` |
| 4 | UI | `problem_user` sees one image for every product | Each product shows its own image | All products show the same image |

Observations handled in the tests: `/ping` and `DELETE /booking/:id` return `201 Created` where `200` or `204` would be standard.
