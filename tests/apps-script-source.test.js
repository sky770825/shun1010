const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourcePath = path.join(__dirname, '..', 'google-apps-script', '常順班表-WebApp.gs');

test('keeps the Apps Script backend source in this repository', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /function doGet\(e\)/);
  assert.match(source, /function doPost\(e\)/);
  assert.match(source, /function getSchedule\(/);
  assert.match(source, /const SPREADSHEET_ID = '1_eujc5OwWR4riQ0oAkGbkkIQQXaX5U3a9xCLvi_qgoU';/);
});
