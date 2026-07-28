'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');

const source = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
const context = {
  console,
  crypto: webcrypto,
  structuredClone,
  Date,
  Math,
  JSON,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Blob,
  URL,
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  globalThis: null,
  __LUNA_TEST_MODE__: true
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'app.js' });
const api = context.__LUNA_TEST_API__;
assert(api, 'Test API was not exposed');

let passed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}

test('Date arithmetic crosses month boundaries', () => {
  assert.equal(api.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(api.daysBetween('2026-01-31', '2026-02-01'), 1);
});

test('Leap-day arithmetic is correct', () => {
  assert.equal(api.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(api.addDays('2028-02-29', 1), '2028-03-01');
});

test('Initial prediction uses configured cycle length', () => {
  const s = structuredClone(api.defaultState);
  s.settings.recentPeriodStart = '2026-07-01';
  s.settings.typicalCycleLength = 30;
  s.logs = {};
  api.setState(s);
  const c = api.cycleData();
  assert.equal(c.predictedStart, '2026-07-31');
  assert.equal(c.predictedLength, 30);
  assert.equal(c.label, 'Initial estimate');
});

test('Period days are grouped into one period', () => {
  const s = structuredClone(api.defaultState);
  s.settings.recentPeriodStart = '2026-06-01';
  s.logs = {
    '2026-06-01': { date:'2026-06-01', bleeding:'medium', countsAsPeriod:true },
    '2026-06-02': { date:'2026-06-02', bleeding:'light', countsAsPeriod:true },
    '2026-06-03': { date:'2026-06-03', bleeding:'heavy', countsAsPeriod:true }
  };
  api.setState(s);
  api.rebuildPeriods();
  const out = api.getState();
  assert.equal(out.periods.length, 1);
  assert.equal(out.periods[0].startDate, '2026-06-01');
  assert.equal(out.periods[0].endDate, '2026-06-03');
});

test('Spotting does not automatically create a period', () => {
  const s = structuredClone(api.defaultState);
  s.logs = { '2026-06-10': { date:'2026-06-10', bleeding:'spotting', countsAsPeriod:true } };
  api.setState(s);
  api.rebuildPeriods();
  assert.equal(api.getState().periods.length, 0);
});

test('Recent recorded cycles influence prediction', () => {
  const s = structuredClone(api.defaultState);
  s.settings.recentPeriodStart = '2026-05-01';
  s.settings.typicalCycleLength = 28;
  s.logs = {};
  for (const d of ['2026-05-01','2026-05-29','2026-06-27','2026-07-26']) {
    s.logs[d] = { date:d, bleeding:'medium', countsAsPeriod:true };
  }
  api.setState(s);
  const c = api.cycleData();
  assert.equal(c.predictedLength, 29);
  assert.equal(c.label, 'Based on recent cycles');
});

test('Prediction range has a minimum two-day allowance', () => {
  const s = structuredClone(api.defaultState);
  s.settings.recentPeriodStart = '2026-07-01';
  s.logs = {};
  api.setState(s);
  assert.equal(api.cycleData().allowance, 2);
});

test('Clamping prevents invalid settings values', () => {
  assert.equal(api.clamp(5, 15, 60), 15);
  assert.equal(api.clamp(100, 15, 60), 60);
});



test('Daily check-in appears only when today has no log', () => {
  const s = structuredClone(api.defaultState);
  s.onboardingComplete = true;
  s.settings.lastBackupAt = new Date().toISOString();
  s.notifications.lastSeenAppVersion = '2.1.0';
  s.logs = {};
  api.setState(s);
  assert(api.buildNotifications().some(n => n.type === 'checkin'));
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  s.logs[iso] = { date:iso, bleeding:'none', countsAsPeriod:false, symptoms:[], moods:[] };
  api.setState(s);
  assert(!api.buildNotifications().some(n => n.type === 'checkin'));
});

test('Backup reminder appears when no backup exists', () => {
  const s = structuredClone(api.defaultState);
  s.onboardingComplete = true;
  s.settings.lastBackupAt = null;
  s.logs = { };
  api.setState(s);
  assert(api.buildNotifications().some(n => n.type === 'backup'));
});

test('Fertile reminder respects the fertile-window setting', () => {
  const s = structuredClone(api.defaultState);
  s.onboardingComplete = true;
  s.settings.lastBackupAt = new Date().toISOString();
  s.settings.showFertileWindow = false;
  const today = new Date();
  const recent = new Date(today); recent.setDate(today.getDate() - 13);
  const iso = `${recent.getFullYear()}-${String(recent.getMonth()+1).padStart(2,'0')}-${String(recent.getDate()).padStart(2,'0')}`;
  s.settings.recentPeriodStart = iso;
  s.logs = { [iso]: { date:iso, bleeding:'medium', countsAsPeriod:true, symptoms:[], moods:[] } };
  api.setState(s);
  assert(!api.buildNotifications().some(n => n.type === 'fertile'));
  s.settings.showFertileWindow = true;
  api.setState(s);
  assert(api.buildNotifications().some(n => n.type === 'fertile'));
});

test('Dismissed notifications stay hidden for their dismissal period', () => {
  const s = structuredClone(api.defaultState);
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const key = api.notificationKey('daily-checkin', iso);
  s.notifications.dismissed[key] = iso;
  api.setState(s);
  assert.equal(api.isNotificationDismissed(key), true);
});

console.log(`\n${passed} core tests passed.`);
