const fs = require('node:fs');
const path = require('node:path');

fs.rmSync(path.join(process.cwd(), 'allure-results'), { recursive: true, force: true });
