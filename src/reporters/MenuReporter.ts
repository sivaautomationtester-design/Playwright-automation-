import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep
} from '@playwright/test/reporter';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ============================================================
// Playwright menu reporter
// HTML report organized by test suite and feature:
//   side menu  = test suites and their categories
//   page tabs  = optional features inside a category
// Every menu item shows its passed / failed counts; groups, test
// groups and test details expand and collapse.
// Output: menu-report/index.html (rewritten after every test).
// ============================================================

const OUTPUT_FILE = 'menu-report/index.html';

// ------------------------------------------------------------
// `features` are optional tabs inside a submenu.
// ------------------------------------------------------------

type MenuSub = { name: string; features?: string[] };
type MenuGroup = { name: string; icon: string; subs?: MenuSub[] };

const REPORT_MENU: MenuGroup[] = [
  {
    name: 'API Tests',
    icon: 'analytics',
    subs: [{ name: 'Booking lifecycle' }, { name: 'Negative cases' }, { name: 'Known defects' }]
  },
  {
    name: 'UI Tests',
    icon: 'dashboard',
    subs: [
      { name: 'Authentication' },
      { name: 'Login' },
      { name: 'Cart' },
      { name: 'Sorting' },
      { name: 'Checkout' },
      { name: 'Known defects' }
    ]
  }
];

// ------------------------------------------------------------
// Where each spec lives in the report menu.
// menu = "Group" or "Group/Submenu"; feature = tab inside it.
// Add a line here when you add a new spec. Unlisted specs go
// under "Unmapped".
// ------------------------------------------------------------

const SPEC_MENU: Record<string, { menu: string; feature?: string }> = {
  'tests/Backend/booking-lifecycle.spec.ts': { menu: 'API Tests/Booking lifecycle' },
  'tests/Backend/booking-negative.spec.ts': { menu: 'API Tests/Negative cases' },
  'tests/Backend/known-defects.spec.ts': { menu: 'API Tests/Known defects' },
  'tests/Frondend/auth.setup.ts': { menu: 'UI Tests/Authentication' },
  'tests/Frondend/login.spec.ts': { menu: 'UI Tests/Login' },
  'tests/Frondend/cart.spec.ts': { menu: 'UI Tests/Cart' },
  'tests/Frondend/sorting.spec.ts': { menu: 'UI Tests/Sorting' },
  'tests/Frondend/checkout.spec.ts': { menu: 'UI Tests/Checkout' },
  'tests/Frondend/known-defects.spec.ts': { menu: 'UI Tests/Known defects' }
};

// Side menu icons (24x24 stroke paths)
const ICONS: Record<string, string> = {
  all:       '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  dashboard: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  tracking:  '<path d="M4 19V6l5-2 6 2 5-2v13l-5 2-6-2z"/><path d="M9 4v13M15 6v13"/>',
  analytics: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
  sessions:  '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  alerts:    '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  geofence:  '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  workflow:  '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h8M8 14h5"/>',
  asset:     '<path d="M5 17h14M6 17l1.5-5h9L18 17M8 12l1-3h6l1 3"/><circle cx="8" cy="17.5" r="1.5"/><circle cx="16" cy="17.5" r="1.5"/>',
  user:      '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  role:      '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.2c2.3.2 4 1.9 4.5 4.8"/>',
  partner:   '<rect x="5" y="4" width="14" height="16" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8.5 16.5c.6-1.8 1.9-2.8 3.5-2.8s2.9 1 3.5 2.8"/>',
  reports:   '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  audit:     '<path d="M7 3h10v18H7z"/><circle cx="12" cy="11" r="2.5"/><path d="M14 13l2 2"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  unmapped:  '<path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10l2 2h6.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/>'
};

// Playwright adds these for test.describe.serial etc. — not useful in the report
const HIDDEN_ANNOTATIONS = ['serial', 'parallel', 'default'];

type Status = 'passed' | 'failed' | 'flaky' | 'known' | 'skipped' | 'pending';

type StepRecord = { title: string; duration: number; depth: number; error: boolean };

type TestRecord = {
  id: string;
  order: number;
  menu: string;
  feature: string;
  title: string;
  describe: string;
  file: string;
  line: number;
  status: Status;
  duration: number;
  retry: number;
  annotations: string[];
  error: string;
  stack: string;
  snippet: string;
  screenshot: string;
  steps: StepRecord[];
  logs: string[];
};

const ANSI = /\u001b\[[0-9;]*m/g;

function stripAnsi(text: string | undefined): string {
  return (text ?? '').replace(ANSI, '');
}

function statusOf(test: TestCase, result: TestResult): Status {
  const outcome = test.outcome();

  if (outcome === 'skipped') return 'skipped';
  if (outcome === 'flaky') return 'flaky';

  // test.fail(): failing is the expected result -> known bug
  if (outcome === 'expected') {
    return result.status === 'passed' ? 'passed' : 'known';
  }

  return 'failed';
}

function menuRank(test: TestRecord): number {
  const [groupName, subName] = test.menu.split('/');
  const g = REPORT_MENU.findIndex(m => m.name === groupName);
  const group = REPORT_MENU[g];
  const s = group?.subs?.findIndex(sub => sub.name === subName) ?? -1;
  const f = group?.subs?.[s]?.features?.indexOf(test.feature) ?? -1;

  // unmapped specs go last
  return (g < 0 ? 999 : g) * 10000 + (s + 1) * 100 + (f + 1);
}

function collectSteps(steps: TestStep[], depth: number, out: StepRecord[]): void {
  for (const step of steps) {
    if (out.length >= 120) return;
    if (!['test.step', 'pw:api', 'expect'].includes(step.category)) continue;

    out.push({ title: step.title, duration: step.duration, depth, error: !!step.error });

    if (depth < 2) collectSteps(step.steps, depth + 1, out);
  }
}


class MenuReporter implements Reporter {

  private rootDir = '';
  private startTime = new Date();
  private projects: string[] = [];
  private workers = 1;
  private tests = new Map<string, TestRecord>();
  private finished = false;

  onBegin(config: FullConfig, suite: Suite): void {

    this.rootDir = config.rootDir;
    this.startTime = new Date();
    this.workers = config.workers;
    this.projects = [...new Set(config.projects.map(p => p.name).filter(name => !name.endsWith('-setup')))];

    // Register every test up front so not-yet-run tests show too
    suite.allTests().forEach((test, order) => {
      this.tests.set(test.id, this.baseRecord(test, order));
    });

    this.write();
  }

  onTestEnd(test: TestCase, result: TestResult): void {

    const record = this.baseRecord(test, this.tests.get(test.id)?.order ?? this.tests.size);

    record.status = statusOf(test, result);
    record.duration = result.duration;
    record.retry = result.retry;

    record.error = result.errors
      .map(error => stripAnsi(error.message ?? error.value))
      .join('\n\n');

    record.stack = stripAnsi(result.errors[0]?.stack);
    record.snippet = stripAnsi(result.errors[0]?.snippet);

    const screenshot = result.attachments.find(a => a.contentType === 'image/png' && a.path);

    if (screenshot?.path && fs.existsSync(screenshot.path)) {
      record.screenshot =
        'data:image/png;base64,' + fs.readFileSync(screenshot.path).toString('base64');
    }

    collectSteps(result.steps, 0, record.steps);

    record.logs = result.stdout
      .map(chunk => stripAnsi(chunk.toString()))
      .join('')
      .split(/\r?\n/)
      .filter(line => line.trim())
      .slice(-300);

    this.tests.set(test.id, record);
    this.write();
  }

  async onEnd(_result: FullResult): Promise<void> {

    this.finished = true;
    this.write();

    console.log(`📋 Menu report: ${path.resolve(OUTPUT_FILE)}`);
  }

  printsToStdio(): boolean {
    return false;
  }

  // ------------------------------------------------------------

  private baseRecord(test: TestCase, order: number): TestRecord {

    const relative = path.relative(this.rootDir, test.location.file);
    const fileName = path.basename(relative);
    const relativePath = relative.split(path.sep).join('/');

    // titlePath: ['', project, file, ...describes, title]
    const describes = test.titlePath().slice(3, -1).filter(Boolean);

    const mapped = SPEC_MENU[relativePath];

    return {
      id: test.id,
      order,
      menu: mapped?.menu ?? 'Unmapped',
      feature: mapped?.feature ?? (mapped ? '' : fileName.replace(/\.spec\.ts$/, '')),
      title: test.title,
      describe: describes.join(' › '),
      file: relative.split(path.sep).join('/'),
      line: test.location.line,
      status: 'pending',
      duration: 0,
      retry: 0,
      annotations: test.annotations
        .filter(a => !HIDDEN_ANNOTATIONS.includes(a.type))
        .map(a => a.description ? `${a.type}: ${a.description}` : a.type),
      error: '',
      stack: '',
      snippet: '',
      screenshot: '',
      steps: [],
      logs: []
    };
  }

  private write(): void {

    // Report menu order (suite > category > feature), then run order
    const tests = [...this.tests.values()].sort(
      (a, b) => menuRank(a) - menuRank(b) || a.order - b.order
    );

    const data = {
      title: 'Playwright Test Report',
      subtitle: process.env.PROJECT_NAME ?? 'SauceDemo & Restful-Booker',
      environment: process.env.TEST_ENV ?? process.env.NODE_ENV ?? '',
      author: process.env.TEST_AUTHOR ?? '',
      projects: this.projects,
      platform: { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[os.platform() as string] ?? os.platform(),
      workers: this.workers,
      startTime: this.startTime.toISOString(),
      elapsed: Date.now() - this.startTime.getTime(),
      finished: this.finished,
      menu: REPORT_MENU,
      icons: ICONS,
      tests
    };

    // Keep "</script>" inside data from closing the script tag
    const json = JSON.stringify(data).replace(/</g, '\\u003c');

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, renderHtml(json));
  }
}


// ============================================================
// HTML
// ============================================================

function renderHtml(json: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Playwright Test Report</title>
<style>${CSS}</style>
</head>
<body>
<div class="app-shell" id="appShell">
  <header class="top-header">
    <div class="brand-cell">
      <span class="report-badge">PW</span><span class="brand-divider"></span><span class="report-wordmark">PLAYWRIGHT</span>
    </div>
    <button type="button" class="menu-toggle" id="menuToggle" aria-label="Toggle menu">&#9776;</button>
    <div class="brand-center"><span class="brand-title" id="brandTitle"></span></div>
    <div class="header-actions" id="headerActions"></div>
  </header>
  <div class="content-shell">
    <aside class="sidebar" id="sidebar"><nav id="nav" aria-label="Test suites"></nav></aside>
    <main class="main-content" id="main"></main>
  </div>
</div>
<div class="modal" id="shotModal" role="dialog" aria-label="Screenshot">
  <button type="button" class="modal-close" aria-label="Close">&times;</button>
  <img id="shotImg" alt="">
</div>
<script type="application/json" id="report-data">${json}</script>
<script>${CLIENT_JS}</script>
</body>
</html>`;
}

const CSS = `
:root {
  --bg: #f4f4f4;
  --surface: #ffffff;
  --border: #ececec;
  --text: #141414;
  --muted: #6f6f6f;
  --sidebar: #fff6ea;
  --sidebar-hover: #fdebd2;
  --sidebar-active: #fde3bd;
  --brand: #f5a81c;
  --green: #0b7a3b;
  --green-2: #2f9e5b;
  --green-bg: #e7f5ec;
  --red: #d7262f;
  --red-bg: #fdecec;
  --purple: #6b4fbb;
  --purple-bg: #f0ecfb;
  --amber: #b26a00;
  --amber-bg: #fff3dc;
  --grey: #9a9a9a;
  --grey-bg: #f0f0f0;
  --side-w: 310px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--text); min-height: 100vh;
  font: 14px/1.45 "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
}
button, input { font: inherit; }
button { cursor: pointer; }

/* ---------- top header ---------- */
.top-header {
  height: 72px; background: var(--surface); display: flex; align-items: center;
  position: sticky; top: 0; z-index: 20; box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
.brand-cell { width: var(--side-w); flex: 0 0 var(--side-w); display: flex; align-items: center; gap: 12px; padding-left: 22px; }
.report-badge {
  display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%;
  background: var(--brand); color: #fff; font-weight: 800; font-style: italic; font-size: 16px;
}
.brand-divider { width: 1px; height: 32px; background: var(--text); }
.report-wordmark { font-weight: 800; font-size: 18px; letter-spacing: .5px; }
.menu-toggle { border: 0; background: transparent; font-size: 22px; color: var(--green); padding: 8px 14px; }
.brand-center { flex: 1; display: flex; justify-content: center; min-width: 0; }
.brand-title { font-weight: 800; font-size: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header-actions { display: flex; align-items: center; gap: 16px; padding-right: 24px; color: var(--muted); font-size: 12.5px; }
.env-pill { background: #fff6ea; color: var(--text); border: 1px solid #f3dcb8; border-radius: 16px; padding: 4px 12px; font-weight: 800; }
.live { color: var(--amber); font-weight: 700; }
.bell { position: relative; display: grid; place-items: center; width: 30px; height: 30px; color: #555; }
.bell svg { width: 22px; height: 22px; fill: currentColor; }
.bell-badge {
  position: absolute; top: -4px; right: -6px; min-width: 18px; height: 18px; border-radius: 9px; background: var(--red);
  color: #fff; font-style: normal; font-size: 10.5px; font-weight: 700; display: grid; place-items: center; padding: 0 4px;
}

/* ---------- layout ---------- */
.content-shell { display: flex; align-items: flex-start; min-height: calc(100vh - 72px); }
.sidebar {
  width: var(--side-w); flex: 0 0 var(--side-w); background: var(--sidebar); border-right: 1px solid #f3e4cc;
  position: sticky; top: 72px; height: calc(100vh - 72px); overflow-y: auto; padding: 10px 0 30px;
}
.app-shell.collapsed .sidebar { display: none; }
.main-content { flex: 1; min-width: 0; padding: 22px 26px 50px; }

/* ---------- side menu ---------- */
.nav-main {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 0 14px 0 16px;
  border: 0; background: none; color: var(--text); text-align: left; font-size: 15.5px;
}
.nav-main:hover, .nav-sub:hover { background: var(--sidebar-hover); }
.nav-icon { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 36px; color: var(--text); }
.nav-icon svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.nav-group.has-active > .nav-main .nav-icon, .nav-main.active .nav-icon { background: var(--brand); color: #fff; }
.nav-main.active, .nav-group.has-active > .nav-main { font-weight: 700; }
.nav-label, .nav-sub-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav-chev { width: 16px; height: 16px; flex: 0 0 16px; fill: none; stroke: currentColor; stroke-width: 2; transition: transform .15s; }
.nav-group.open > .nav-main .nav-chev { transform: rotate(90deg); }
.nav-subs { display: none; padding: 2px 0 8px; }
.nav-group.open > .nav-subs { display: block; }
.nav-sub {
  display: flex; align-items: center; gap: 14px; width: 100%; min-height: 42px; padding: 0 14px 0 34px;
  border: 0; background: none; color: var(--text); text-align: left; font-size: 14.5px;
}
.radio { width: 13px; height: 13px; border-radius: 50%; border: 1.6px solid #555; background: #fff; flex: 0 0 13px; }
.nav-sub.active { font-weight: 700; background: var(--sidebar-active); }
.nav-sub.active .radio { background: var(--green); border-color: var(--green); }
.nav-empty { color: #9b8f80; }
.nav-empty .nav-icon { color: #8e8478; }
.cnts { display: inline-flex; gap: 4px; }
.cnt {
  min-width: 22px; height: 20px; border-radius: 10px; font-size: 11px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; padding: 0 6px;
}
.cnt.pass { background: var(--green-bg); color: var(--green); }
.cnt.fail { background: var(--red); color: #fff; }
.cnt.known { background: var(--purple-bg); color: var(--purple); }

/* ---------- breadcrumb + summary ---------- */
.breadcrumb-card { background: var(--surface); border-radius: 10px; padding: 16px 18px; font-size: 15px; border: 1px solid var(--border); }
.breadcrumb-card b { font-weight: 800; }
.breadcrumb-card button { border: 0; background: none; padding: 0; color: var(--green); font-weight: 700; }
.breadcrumb-card button:hover { text-decoration: underline; }
.breadcrumb-card .sep { color: var(--muted); margin: 0 6px; }
.summary-header { margin-top: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px 0; }
.summary-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.summary-title-row h1 { margin: 0; font-size: 22px; font-weight: 800; }
.summary-title-row p { margin: 4px 0 0; color: var(--muted); }
.run-info { color: var(--muted); font-size: 12.5px; padding-top: 4px; text-align: right; }
.summary-main { display: flex; align-items: center; justify-content: space-between; padding: 20px 0 18px; gap: 16px; }
.summary-numbers { display: flex; flex-wrap: wrap; align-items: center; gap: 18px 40px; }
.metric-label { display: block; color: var(--muted); font-size: 12.5px; margin-bottom: 4px; }
.metric strong { font-size: 30px; line-height: 1; font-variant-numeric: tabular-nums; }
.metric.failed strong { color: var(--red); }
.metric.passed strong { color: var(--green); }
.metric.known strong { color: var(--purple); }
.metric.flaky strong { color: var(--amber); }
.metric.skipped strong { color: var(--grey); }
.donut-wrap { width: 118px; height: 118px; position: relative; flex: none; margin-right: 12px; }
.donut { transform: rotate(-90deg); }
.donut circle { fill: none; stroke-width: 10; }
.donut .bg { stroke: #efefef; }
.donut .pass { stroke: var(--green-2); }
.donut .fail { stroke: var(--red); }
.donut .known { stroke: #8b71d6; }
.donut .skip { stroke: #cfcfcf; }
.donut-label { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.donut-label strong { font-size: 20px; }
.donut-label span { color: var(--muted); font-size: 10.5px; margin-top: 2px; }
.metadata-row { border-top: 1px solid var(--border); display: flex; gap: 8px 24px; padding: 12px 0; color: var(--muted); font-size: 12px; flex-wrap: wrap; }
.metadata-row b { color: #3d3d3d; margin-right: 5px; }

/* ---------- feature tabs ---------- */
.feature-tabs { margin-top: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; display: flex; overflow-x: auto; }
.ftab {
  flex: 1 0 auto; border: 0; background: none; padding: 14px 18px; color: var(--text); font-weight: 600;
  border-bottom: 3px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap;
}
.ftab:hover { background: #fcfaf6; }
.ftab[aria-selected="true"] { color: var(--green); border-bottom-color: var(--green); }
.ftab.empty { color: #aaa; font-weight: 500; }

/* ---------- toolbar ---------- */
.result-toolbar {
  margin-top: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  background: #fbf3e6; border: 1px solid #f3e4cc; border-bottom: 0; border-radius: 12px 12px 0 0; padding: 0 10px;
}
.tabs { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
.tab { border: 0; background: transparent; padding: 13px 14px; color: var(--muted); border-bottom: 3px solid transparent; }
.tab[aria-selected="true"] { color: var(--text); border-bottom-color: var(--green); font-weight: 800; background: var(--surface); }
.tab span { background: #ececec; color: #444; border-radius: 10px; padding: 1px 7px; font-size: 11px; margin-left: 4px; font-weight: 700; }
.tab span.red { color: #fff; background: var(--red); }
.tab span.green { color: #fff; background: var(--green-2); }
.tab span.purple { color: #fff; background: #8b71d6; }
.tab span.gray { color: #fff; background: #ababab; }
.toolbar-right { display: flex; gap: 8px; align-items: center; padding: 8px 0; flex-wrap: wrap; }
.search-box {
  height: 36px; width: 260px; background: var(--surface); border: 1px solid var(--border); border-radius: 18px;
  display: flex; align-items: center; padding: 0 12px; color: #888;
}
.search-box input { border: 0; outline: 0; width: 100%; padding-left: 8px; background: none; color: var(--text); }
.tool-btn { height: 36px; border: 1px solid var(--green); background: var(--surface); border-radius: 10px; padding: 0 12px; color: var(--green); font-weight: 600; }
.tool-btn:hover { background: var(--green-bg); }

/* ---------- results ---------- */
.results-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0 0 12px 12px; overflow: hidden; }
.result-list-header {
  height: 42px; padding: 0 16px; display: flex; justify-content: space-between; align-items: center;
  color: #fff; font-size: 11.5px; font-weight: 800; letter-spacing: .6px; background: var(--green);
}
.group-head {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 50px; padding: 0 16px;
  border: 0; border-bottom: 1px solid var(--border); background: #fffaf2; text-align: left; color: var(--text);
}
.group-head:hover { background: #fdf2e1; }
.group-title { flex: 1; min-width: 0; font-weight: 800; font-size: 14.5px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.group-stats { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--muted); }
.stat { font-weight: 700; white-space: nowrap; }
.stat.passed { color: var(--green); } .stat.failed { color: var(--red); } .stat.known { color: var(--purple); }
.stat.flaky { color: var(--amber); } .stat.skipped, .stat.pending { color: var(--grey); }
.bar { display: flex; width: 110px; height: 7px; border-radius: 4px; overflow: hidden; background: var(--grey-bg); flex: none; }
.bar i { display: block; height: 100%; }
.bar .passed, .bar .flaky { background: var(--green-2); } .bar .failed { background: var(--red); }
.bar .known { background: #8b71d6; } .bar .skipped, .bar .pending { background: #cfcfcf; }
.chev { width: 14px; height: 14px; flex: none; fill: none; stroke: #777; stroke-width: 2; transition: transform .15s; }
.open > .group-head .chev, .test-item.expanded .test-row-main .chev { transform: rotate(90deg); }
.group-body { display: none; }
.test-group.open > .group-body { display: block; }

.test-item { border-bottom: 1px solid #f1f1f1; }
.test-row-main {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 0 16px 0 28px;
  border: 0; background: none; text-align: left; color: var(--text);
}
.test-row-main:hover { background: #fcfcfc; }
.status-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 10px; }
.status-dot.passed { background: var(--green-2); } .status-dot.failed { background: var(--red); }
.status-dot.known { background: #8b71d6; } .status-dot.flaky { background: #e6a23c; }
.status-dot.skipped, .status-dot.pending { background: #bdbdbd; }
.test-main-info { min-width: 0; flex: 1; }
.test-title { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.test-subtitle { color: #8a8a8a; font-size: 11.5px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.result-duration { width: 64px; text-align: right; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.result-status { width: 78px; text-align: right; font-size: 12px; font-weight: 700; }
.result-status.passed { color: var(--green); } .result-status.failed { color: var(--red); }
.result-status.known { color: var(--purple); } .result-status.flaky { color: var(--amber); }
.result-status.skipped, .result-status.pending { color: var(--grey); }
.test-meta-line { padding: 0 16px 10px 66px; display: flex; align-items: center; gap: 8px; color: #9a9a9a; font-size: 11px; flex-wrap: wrap; }
.module-chip { background: #fff1dc; color: #6b4a12; padding: 2px 8px; border-radius: 8px; font-weight: 700; }
.tag { background: #f1f1f1; color: #666; padding: 2px 7px; border-radius: 8px; }
.tag.retry { background: #eef3ff; color: #3456b8; }
.tag.note { background: var(--purple-bg); color: var(--purple); }
.meta-spacer { flex: 1; }
.link-btn { border: 0; background: none; color: var(--green); padding: 0; font-size: 11px; font-weight: 700; }
.link-btn:hover { text-decoration: underline; }

/* ---------- test detail ---------- */
.test-detail-row { display: none; background: #fcfbf8; border-top: 1px solid #f1f1f1; padding: 14px 22px 18px 66px; }
.test-item.expanded .test-detail-row { display: block; }
.detail-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.detail-section { border-bottom: 1px solid #f1f1f1; }
.detail-section:last-child { border-bottom: 0; }
.detail-section > summary { padding: 10px 13px; font-weight: 700; font-size: 12.5px; cursor: pointer; background: #fafafa; }
.section-content { padding: 12px; }
.error-box { background: var(--red-bg); border: 1px solid #f6caca; border-left: 3px solid var(--red); border-radius: 6px; padding: 10px; }
pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: 12px/1.5 Consolas, "Cascadia Mono", monospace; }
.error-message { color: #8f1219; }
.snippet { margin-top: 10px; background: #1e1e1e; color: #e6e6e6; padding: 10px 12px; border-radius: 6px; overflow-x: auto; }
.stack-details { margin-top: 8px; color: #666; }
.stack-details pre { background: #f6f6f6; padding: 8px; border-radius: 4px; max-height: 260px; overflow: auto; margin-top: 6px; }
.console { background: #141c2b; color: #d5dbea; border-radius: 6px; padding: 8px 10px; max-height: 300px; overflow: auto; font: 11.5px/1.55 Consolas, "Cascadia Mono", monospace; }
.console div { white-space: pre-wrap; word-break: break-word; }
.steps { list-style: none; margin: 0; padding: 0; font-size: 12.5px; }
.steps li { display: flex; gap: 8px; padding: 3px 0; color: #444; }
.steps li.bad { color: var(--red); font-weight: 700; }
.steps .s-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.steps .s-time { color: #999; font-size: 11px; }
.shot { max-width: min(100%, 560px); border: 1px solid var(--border); border-radius: 6px; cursor: zoom-in; display: block; }
.empty-results { padding: 36px; color: #8a8a8a; text-align: center; }

.modal { display: none; position: fixed; z-index: 1000; inset: 0; background: rgba(0,0,0,.78); align-items: center; justify-content: center; padding: 24px; }
.modal.active { display: flex; }
.modal img { max-width: 100%; max-height: 100%; border-radius: 6px; }
.modal-close { position: absolute; top: 14px; right: 24px; color: #fff; font-size: 34px; background: none; border: 0; }

@media (max-width: 900px) {
  :root { --side-w: 240px; }
  .main-content { padding: 16px; }
  .search-box { width: 180px; }
  .header-date { display: none; }
}
@media (max-width: 700px) {
  .content-shell { display: block; }
  .sidebar { position: static; width: 100%; height: auto; max-height: 50vh; }
  .brand-cell { width: auto; flex: 0 0 auto; padding-left: 14px; }
  .report-wordmark { display: none; } .brand-divider { display: none; }
  .brand-title { font-size: 16px; }
  .summary-main { display: block; }
  .donut-wrap { margin: 18px auto 0; }
  .test-row-main { padding-left: 14px; }
  .test-meta-line, .test-detail-row { padding-left: 16px; }
  .result-duration, .bar { display: none; }
  .header-actions { padding-right: 12px; }
}
`;

// Client-side script: builds the whole page from the embedded JSON.
// (Plain strings only — no template literals — because it is
// embedded inside a template literal.)
const CLIENT_JS = `
(function () {
  var DATA = JSON.parse(document.getElementById('report-data').textContent);

  var STATUS = {
    passed:  'Passed',
    failed:  'Failed',
    known:   'Known bug',
    flaky:   'Flaky',
    skipped: 'Skipped',
    pending: 'Not run'
  };
  var ORDER = ['passed', 'failed', 'known', 'flaky', 'skipped', 'pending'];
  var CHEV = '<svg class="chev" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg>';
  var SEP = ' \\u203A ';

  var state = { menu: '', feature: '', status: 'all', query: '' };
  var openGroups = {};
  var openTests = {};
  var closedTestGroups = {};

  // ---------- helpers ----------
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function svgIcon(name) {
    return '<svg viewBox="0 0 24 24">' + (DATA.icons[name] || DATA.icons.unmapped) + '</svg>';
  }
  function fmtDur(ms) {
    if (!ms) return '0s';
    if (ms < 1000) return ms + 'ms';
    var s = ms / 1000;
    if (s < 60) return (s < 10 ? s.toFixed(1) : Math.round(s)) + 's';
    var m = Math.floor(s / 60);
    return m + 'm ' + Math.round(s % 60) + 's';
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function countOf(tests) {
    var c = { total: tests.length, duration: 0 };
    ORDER.forEach(function (s) { c[s] = 0; });
    tests.forEach(function (t) { c[t.status]++; c.duration += t.duration; });
    c.ok = c.passed + c.flaky;
    return c;
  }
  function groupOf(key) { return key.split('/')[0]; }
  function inMenu(t, key) { return !key || t.menu === key || t.menu.indexOf(key + '/') === 0; }
  function testsIn(key, feature) {
    return DATA.tests.filter(function (t) { return inMenu(t, key) && (!feature || t.feature === feature); });
  }
  function matches(t) {
    if (state.status !== 'all' && t.status !== state.status) return false;
    if (state.query) {
      var hay = (t.title + ' ' + t.menu + ' ' + t.feature + ' ' + t.describe + ' ' + t.file).toLowerCase();
      if (hay.indexOf(state.query) < 0) return false;
    }
    return true;
  }
  function menuLabel(t) { return t.menu.split('/').concat(t.feature ? [t.feature] : []).join(SEP); }

  // Report menu + an "Unmapped" group when some specs are not in SPEC_MENU
  var MENU = DATA.menu.slice();
  if (DATA.tests.some(function (t) { return t.menu === 'Unmapped'; })) {
    MENU.push({ name: 'Unmapped', icon: 'unmapped' });
  }
  function subDef(key) {
    var parts = key.split('/');
    var g = MENU.filter(function (m) { return m.name === parts[0]; })[0];
    if (!g || !parts[1] || !g.subs) return null;
    return g.subs.filter(function (s) { return s.name === parts[1]; })[0] || null;
  }

  // ---------- session-only UI memory (open menu groups) ----------
  function saveOpen() {
    try { sessionStorage.setItem('menuReportOpenGroups', JSON.stringify(openGroups)); } catch (e) {}
  }
  function restoreOpen() {
    try { openGroups = JSON.parse(sessionStorage.getItem('menuReportOpenGroups') || '{}') || {}; } catch (e) { openGroups = {}; }
  }

  // ---------- navigation ----------
  function selectMenu(key, feature) {
    state.menu = key;
    state.feature = feature || '';
    if (key) openGroups[groupOf(key)] = true;
    saveOpen();
    try { history.replaceState(null, '', key ? '#' + encodeURIComponent(key + (feature ? '|' + feature : '')) : location.pathname + location.search); } catch (e) {}
    render();
    window.scrollTo(0, 0);
  }

  function cnts(tests) {
    if (!tests.length) return null;
    var c = countOf(tests);
    var wrap = h('span', { class: 'cnts' });
    if (c.ok) wrap.appendChild(h('span', { class: 'cnt pass', title: c.ok + ' passed', text: String(c.ok) }));
    if (c.failed) wrap.appendChild(h('span', { class: 'cnt fail', title: c.failed + ' failed', text: String(c.failed) }));
    if (c.known) wrap.appendChild(h('span', { class: 'cnt known', title: c.known + ' known bug', text: String(c.known) }));
    return wrap;
  }

  function renderSidebar() {
    var nav = document.getElementById('nav');
    nav.innerHTML = '';

    nav.appendChild(h('div', { class: 'nav-group leaf' }, [
      h('button', { type: 'button', class: 'nav-main' + (state.menu === '' ? ' active' : ''), onclick: function () { selectMenu(''); } }, [
        h('span', { class: 'nav-icon', html: svgIcon('all') }),
        h('span', { class: 'nav-label', text: 'All Results' }),
        cnts(DATA.tests)
      ])
    ]));

    MENU.forEach(function (g) {
      var tests = testsIn(g.name);
      var hasSubs = g.subs && g.subs.length;
      var active = state.menu === g.name;
      var hasActive = state.menu && groupOf(state.menu) === g.name;
      var open = !!openGroups[g.name];

      var group = h('div', {
        class: 'nav-group' + (hasSubs ? '' : ' leaf') + (open ? ' open' : '') + (hasActive && hasSubs ? ' has-active' : '')
      });

      group.appendChild(h('button', {
        type: 'button',
        class: 'nav-main' + (active ? ' active' : '') + (tests.length ? '' : ' nav-empty'),
        'aria-expanded': hasSubs ? String(open) : null,
        onclick: function () {
          if (!hasSubs) { selectMenu(g.name); return; }
          // first click selects the module (all its tests); next click collapses it
          if (state.menu === g.name && open) { openGroups[g.name] = false; saveOpen(); renderSidebar(); return; }
          selectMenu(g.name);
        }
      }, [
        h('span', { class: 'nav-icon', html: svgIcon(g.icon) }),
        h('span', { class: 'nav-label', text: g.name }),
        cnts(tests),
        hasSubs ? h('span', { html: '<svg class="nav-chev" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg>' }).firstChild : null
      ]));

      if (hasSubs) {
        var subs = h('div', { class: 'nav-subs' });
        g.subs.forEach(function (s) {
          var key = g.name + '/' + s.name;
          var st = testsIn(key);
          subs.appendChild(h('button', {
            type: 'button',
            class: 'nav-sub' + (state.menu === key ? ' active' : '') + (st.length ? '' : ' nav-empty'),
            onclick: function () { selectMenu(key); }
          }, [
            h('i', { class: 'radio' }),
            h('span', { class: 'nav-sub-label', text: s.name }),
            cnts(st)
          ]));
        });
        group.appendChild(subs);
      }
      nav.appendChild(group);
    });
  }

  // ---------- main ----------
  function donut(c) {
    var R = 42, CIRC = 2 * Math.PI * R, drawn = 0;
    var segs = [['pass', c.ok], ['fail', c.failed], ['known', c.known], ['skip', c.skipped + c.pending]];
    var svg = '<svg class="donut" width="112" height="112" viewBox="0 0 112 112"><circle class="bg" cx="56" cy="56" r="42"></circle>';
    segs.forEach(function (s) {
      var len = c.total ? (s[1] / c.total) * CIRC : 0;
      if (len) svg += '<circle class="' + s[0] + '" cx="56" cy="56" r="42" stroke-dasharray="' + len + ' ' + (CIRC - len) + '" stroke-dashoffset="' + (-drawn) + '"></circle>';
      drawn += len;
    });
    svg += '</svg>';
    var executed = c.total - c.skipped - c.pending;
    var pct = executed ? (100 * (c.ok + c.known) / executed) : 0;
    return h('div', { class: 'donut-wrap' }, [
      h('span', { html: svg }).firstChild,
      h('div', { class: 'donut-label' }, [h('strong', { text: (Math.round(pct * 100) / 100) + '%' }), h('span', { text: 'Pass rate' })])
    ]);
  }

  function breadcrumb() {
    var card = h('div', { class: 'breadcrumb-card' });
    if (!state.menu) {
      card.appendChild(h('b', { text: 'Test Execution' }));
      card.appendChild(h('span', { class: 'sep', text: '>' }));
      card.appendChild(document.createTextNode('All Modules'));
      return card;
    }
    var parts = state.menu.split('/');
    card.appendChild(h('button', { type: 'button', text: 'Test Execution', onclick: function () { selectMenu(''); } }));
    parts.forEach(function (p, i) {
      card.appendChild(h('span', { class: 'sep', text: '>' }));
      var key = parts.slice(0, i + 1).join('/');
      var last = i === parts.length - 1 && !state.feature;
      card.appendChild(last ? h('b', { text: p }) : h('button', { type: 'button', text: p, onclick: function () { selectMenu(key); } }));
    });
    if (state.feature) {
      card.appendChild(h('span', { class: 'sep', text: '>' }));
      card.appendChild(h('b', { text: state.feature }));
    }
    return card;
  }

  function summary(scope) {
    var c = countOf(scope);
    var title = state.feature || (state.menu ? state.menu.split('/').pop() : 'Test Execution');
    var metrics = [['total', 'Total', c.total], ['failed', 'Failed', c.failed], ['passed', 'Passed', c.ok], ['skipped', 'Skipped', c.skipped + c.pending]];
    if (c.known) metrics.splice(2, 0, ['known', 'Known bugs', c.known]);
    if (c.flaky) metrics.push(['flaky', 'Flaky', c.flaky]);

    var meta = [['Environment', DATA.environment || '-'], ['Projects', DATA.projects.join(', ') || '-'], ['Platform', DATA.platform],
      ['Workers', DATA.workers], ['Duration', state.menu ? fmtDur(c.duration) : fmtDur(DATA.elapsed)], ['Started', fmtDate(DATA.startTime)]];
    if (DATA.author) meta.push(['Executed by', DATA.author]);

    return h('section', { class: 'summary-header' }, [
      h('div', { class: 'summary-title-row' }, [
        h('div', null, [h('h1', { text: title }), h('p', { text: state.menu ? menuPath() : DATA.subtitle })]),
        h('div', { class: 'run-info', text: fmtDate(DATA.startTime) + (DATA.finished ? '' : '  \\u00B7  Running') })
      ]),
      h('div', { class: 'summary-main' }, [
        h('div', { class: 'summary-numbers' }, metrics.map(function (m) {
          return h('div', { class: 'metric ' + m[0] }, [h('span', { class: 'metric-label', text: m[1] }), h('strong', { text: String(m[2]) })]);
        })),
        donut(c)
      ]),
      h('div', { class: 'metadata-row' }, meta.map(function (m) { return h('span', null, [h('b', { text: m[0] }), String(m[1])]); }))
    ]);
  }
  function menuPath() { return state.menu.split('/').concat(state.feature ? [state.feature] : []).join(SEP); }

  function featureTabs() {
    if (!state.menu) return null;
    var sub = subDef(state.menu);
    var features = sub && sub.features ? sub.features.slice() : [];
    testsIn(state.menu).forEach(function (t) {
      if (t.menu === state.menu && t.feature && features.indexOf(t.feature) < 0) features.push(t.feature);
    });
    if (!features.length) return null;

    var all = testsIn(state.menu);
    var bar = h('div', { class: 'feature-tabs', role: 'tablist', 'aria-label': 'Features' });
    bar.appendChild(h('button', {
      type: 'button', class: 'ftab', role: 'tab', 'aria-selected': String(!state.feature),
      onclick: function () { selectMenu(state.menu); }
    }, ['All', cnts(all)]));
    features.forEach(function (f) {
      var ft = testsIn(state.menu, f);
      bar.appendChild(h('button', {
        type: 'button', class: 'ftab' + (ft.length ? '' : ' empty'), role: 'tab', 'aria-selected': String(state.feature === f),
        title: ft.length ? '' : 'No tests for ' + f + ' yet',
        onclick: function () { selectMenu(state.menu, f); }
      }, [f, cnts(ft)]));
    });
    return bar;
  }

  function toolbar(scope) {
    var c = countOf(scope);
    var tabs = [['all', 'Results', c.total, ''], ['failed', 'Failed', c.failed, 'red'], ['passed', 'Passed', c.passed, 'green'], ['skipped', 'Skipped', c.skipped, 'gray']];
    if (c.known) tabs.splice(2, 0, ['known', 'Known bugs', c.known, 'purple']);
    if (c.flaky) tabs.push(['flaky', 'Flaky', c.flaky, '']);
    if (c.pending) tabs.push(['pending', 'Not run', c.pending, 'gray']);

    var search = h('input', { type: 'search', placeholder: 'Search test cases', 'aria-label': 'Search test cases', value: state.query });
    search.addEventListener('input', function () { state.query = search.value.trim().toLowerCase(); renderResults(); });

    return h('div', { class: 'result-toolbar' }, [
      h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Status' }, tabs.map(function (t) {
        return h('button', {
          type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(state.status === t[0]),
          onclick: function () { state.status = t[0]; renderMain(); }
        }, [t[1], h('span', { class: t[3], text: String(t[2]) })]);
      })),
      h('div', { class: 'toolbar-right' }, [
        h('label', { class: 'search-box' }, [h('span', { text: '\\u2315' }), search]),
        h('button', { type: 'button', class: 'tool-btn', text: 'Expand all', onclick: function () { setAll(true); } }),
        h('button', { type: 'button', class: 'tool-btn', text: 'Collapse all', onclick: function () { setAll(false); } })
      ])
    ]);
  }

  function statBits(c) {
    var out = [];
    ORDER.forEach(function (s) { if (c[s]) out.push(h('span', { class: 'stat ' + s, text: c[s] + ' ' + STATUS[s].toLowerCase() })); });
    return out;
  }
  function bar(c) {
    var el = h('span', { class: 'bar' });
    ['passed', 'flaky', 'known', 'failed', 'skipped', 'pending'].forEach(function (s) {
      if (c[s]) el.appendChild(h('i', { class: s, style: 'width:' + (100 * c[s] / c.total) + '%' }));
    });
    return el;
  }

  function testDetail(t) {
    var panel = h('div', { class: 'detail-panel' });
    function section(title, content, open) {
      panel.appendChild(h('details', { class: 'detail-section', open: open }, [h('summary', { text: title }), h('div', { class: 'section-content' }, content)]));
    }
    if (t.error) {
      var box = h('div', { class: 'error-box' }, [h('pre', { class: 'error-message', text: t.error })]);
      if (t.snippet) box.appendChild(h('pre', { class: 'snippet', text: t.snippet }));
      if (t.stack) box.appendChild(h('details', { class: 'stack-details' }, [h('summary', { text: 'Call Stack' }), h('pre', { text: t.stack })]));
      section('Errors', [box], true);
    }
    if (t.screenshot) {
      section('Screenshot', [h('img', { class: 'shot', src: t.screenshot, alt: 'Screenshot at failure: ' + t.title, loading: 'lazy', onclick: function () { openShot(t.screenshot); } })], true);
    }
    if (t.steps.length) {
      var list = h('ul', { class: 'steps' });
      t.steps.forEach(function (s) {
        list.appendChild(h('li', { class: s.error ? 'bad' : '', style: 'padding-left:' + (s.depth * 18) + 'px' }, [
          h('span', { text: s.error ? '\\u2715' : '\\u2713' }),
          h('span', { class: 's-title', title: s.title, text: s.title }),
          h('span', { class: 's-time', text: fmtDur(s.duration) })
        ]));
      });
      section('Steps (' + t.steps.length + ')', [list], t.status === 'failed');
    }
    if (t.logs.length) {
      section('Test Logs (' + t.logs.length + ' lines)', [h('div', { class: 'console' }, t.logs.map(function (l) { return h('div', { text: l }); }))], !t.error);
    }
    if (!panel.children.length) {
      panel.appendChild(h('div', { class: 'empty-results', text: t.status === 'pending' ? 'Not run yet.' : 'No details recorded.' }));
    }
    return panel;
  }

  function testItem(t) {
    var expanded = !!openTests[t.id];
    var item = h('div', { class: 'test-item ' + t.status + (expanded ? ' expanded' : '') });
    var detail = h('div', { class: 'test-detail-row' });
    var filled = false;
    function fill() { if (!filled) { detail.appendChild(testDetail(t)); filled = true; } }
    if (expanded) fill();

    var meta = [h('span', { class: 'module-chip', text: menuLabel(t) }), h('span', { text: t.file + ':' + t.line })];
    if (t.retry) meta.push(h('span', { class: 'tag retry', text: 'retry ' + t.retry }));
    t.annotations.forEach(function (a) { meta.push(h('span', { class: 'tag note', text: a })); });
    meta.push(h('span', { class: 'meta-spacer' }));
    if (t.screenshot) meta.push(h('button', { type: 'button', class: 'link-btn', text: 'Screenshot', onclick: function () { openShot(t.screenshot); } }));

    item.appendChild(h('button', {
      type: 'button', class: 'test-row-main', 'aria-expanded': String(expanded),
      onclick: function () {
        var now = !item.classList.contains('expanded');
        if (now) fill();
        item.classList.toggle('expanded', now);
        this.setAttribute('aria-expanded', String(now));
        openTests[t.id] = now;
      }
    }, [
      h('span', { html: CHEV }).firstChild,
      h('span', { class: 'status-dot ' + t.status }),
      h('span', { class: 'test-main-info' }, [
        h('div', { class: 'test-title', title: t.title, text: t.title }),
        h('div', { class: 'test-subtitle', text: t.file + (t.describe ? SEP + t.describe : '') })
      ]),
      h('span', { class: 'result-duration', text: t.status === 'pending' ? '' : fmtDur(t.duration) }),
      h('span', { class: 'result-status ' + t.status, text: STATUS[t.status] })
    ]));
    item.appendChild(h('div', { class: 'test-meta-line' }, meta));
    item.appendChild(detail);
    return item;
  }

  function renderResults() {
    var list = document.getElementById('testList');
    var count = document.getElementById('listCount');
    if (!list) return;
    list.innerHTML = '';

    var scope = testsIn(state.menu, state.feature);
    var shown = scope.filter(matches);
    count.textContent = shown.length + ' results';

    if (!scope.length) {
      list.appendChild(h('div', { class: 'empty-results', text: 'No test cases for this module in this run.' }));
      return;
    }
    if (!shown.length) {
      list.appendChild(h('div', { class: 'empty-results', text: 'No test cases match this filter.' }));
      return;
    }

    // Group by suite and category, in run order
    var groups = [], byKey = {};
    shown.forEach(function (t) {
      var key = menuLabel(t);
      if (!byKey[key]) { byKey[key] = { key: key, tests: [] }; groups.push(byKey[key]); }
      byKey[key].tests.push(t);
    });

    groups.forEach(function (g) {
      var all = scope.filter(function (t) { return menuLabel(t) === g.key; });
      var c = countOf(all);
      var open = !closedTestGroups[g.key];
      var wrap = h('div', { class: 'test-group' + (open ? ' open' : '') });
      wrap.appendChild(h('button', {
        type: 'button', class: 'group-head', 'aria-expanded': String(open),
        onclick: function () {
          var now = !wrap.classList.contains('open');
          wrap.classList.toggle('open', now);
          this.setAttribute('aria-expanded', String(now));
          closedTestGroups[g.key] = !now;
        }
      }, [
        h('span', { html: CHEV }).firstChild,
        h('span', { class: 'group-title', text: g.key }),
        h('span', { class: 'group-stats' }, statBits(c).concat([bar(c), h('span', { text: fmtDur(c.duration) })]))
      ]));
      wrap.appendChild(h('div', { class: 'group-body' }, g.tests.map(testItem)));
      list.appendChild(wrap);
    });
  }

  function setAll(open) {
    var scope = testsIn(state.menu, state.feature).filter(matches);
    scope.forEach(function (t) { openTests[t.id] = open; closedTestGroups[menuLabel(t)] = !open; });
    renderResults();
  }

  function renderMain() {
    var main = document.getElementById('main');
    main.innerHTML = '';
    var scope = testsIn(state.menu, state.feature);
    main.appendChild(breadcrumb());
    main.appendChild(summary(scope));
    var ft = featureTabs();
    if (ft) main.appendChild(ft);
    main.appendChild(toolbar(scope));
    main.appendChild(h('div', { class: 'results-card' }, [
      h('div', { class: 'result-list-header' }, [h('span', { text: 'TEST CASES' }), h('span', { id: 'listCount' })]),
      h('div', { id: 'testList' })
    ]));
    renderResults();
  }

  function renderHeader() {
    document.getElementById('brandTitle').textContent = DATA.title;
    var c = countOf(DATA.tests);
    var actions = document.getElementById('headerActions');
    actions.innerHTML = '';
    if (DATA.environment) actions.appendChild(h('span', { class: 'env-pill', text: DATA.environment }));
    if (!DATA.finished) actions.appendChild(h('span', { class: 'live', text: '\\u25CF Running \\u2014 refresh for updates' }));
    actions.appendChild(h('span', { class: 'header-date', text: fmtDate(DATA.startTime) }));
    actions.appendChild(h('button', {
      type: 'button', class: 'bell', style: 'border:0;background:none', title: c.failed + ' failed tests', 'aria-label': c.failed + ' failed tests',
      html: '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>' + (c.failed ? '<i class="bell-badge">' + c.failed + '</i>' : ''),
      onclick: function () { state.status = c.failed ? 'failed' : 'all'; selectMenu(''); }
    }));
  }

  function render() { renderSidebar(); renderMain(); }

  // ---------- screenshot modal ----------
  var modal = document.getElementById('shotModal');
  function openShot(src) { document.getElementById('shotImg').src = src; modal.classList.add('active'); }
  modal.addEventListener('click', function (e) { if (e.target !== document.getElementById('shotImg')) modal.classList.remove('active'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.classList.remove('active'); });
  document.getElementById('menuToggle').addEventListener('click', function () { document.getElementById('appShell').classList.toggle('collapsed'); });

  // ---------- start ----------
  restoreOpen();
  try {
    var hash = decodeURIComponent(location.hash.slice(1));
    if (hash) { state.menu = hash.split('|')[0]; state.feature = hash.split('|')[1] || ''; }
  } catch (e) {}
  // Open the menu groups that have failures, plus the selected one
  MENU.forEach(function (g) {
    if (openGroups[g.name] === undefined && countOf(testsIn(g.name)).failed) openGroups[g.name] = true;
  });
  if (state.menu) openGroups[groupOf(state.menu)] = true;

  renderHeader();
  render();
})();
`;

export default MenuReporter;
