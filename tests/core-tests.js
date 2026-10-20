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

// ---- v2.1.1 regression tests ----

const relDay = n => api.addDays(api.dateToISO(new Date()), n);
const dayLog = (date, bleeding, extra = {}) => ({ date, bleeding, countsAsPeriod: true, symptoms: [], moods: [], sexualActivity: [], notes: '', ...extra });

test('One missed day inside a period does not split it', () => {
  const s = structuredClone(api.defaultState);
  s.logs = {};
  ['2026-06-01', '2026-06-02', '2026-06-04', '2026-06-05'].forEach(d => { s.logs[d] = dayLog(d, 'medium'); });
  api.setState(s);
  api.rebuildPeriods();
  const periods = api.getState().periods;
  assert.equal(periods.length, 1);
  assert.equal(periods[0].endDate, '2026-06-05');
});

test('Two missed days are bridged but a longer gap starts a new period', () => {
  const s = structuredClone(api.defaultState);
  s.logs = {};
  ['2026-06-01', '2026-06-04', '2026-06-20'].forEach(d => { s.logs[d] = dayLog(d, 'light'); });
  api.setState(s);
  api.rebuildPeriods();
  assert.deepEqual(api.getState().periods.map(p => p.startDate), ['2026-06-01', '2026-06-20']);
});

test('Migration counts light, medium and heavy days saved without the period box', () => {
  const s = structuredClone(api.defaultState);
  s.logs = {};
  for (let i = 0; i < 5; i++) { const d = relDay(-30 + i); s.logs[d] = dayLog(d, 'heavy', { countsAsPeriod: false }); }
  const spot = relDay(-10); s.logs[spot] = dayLog(spot, 'spotting', { countsAsPeriod: false });
  api.setState(s);
  api.migrateState('2.1.0');
  const out = api.getState();
  assert.equal(out.periods.length, 1);
  assert.equal(out.logs[spot].countsAsPeriod, false, 'spotting must stay opt-in');
});

test('Migration leaves data alone when already on 2.1.1', () => {
  const s = structuredClone(api.defaultState);
  const d = relDay(-20);
  s.logs = { [d]: dayLog(d, 'heavy', { countsAsPeriod: false }) };
  api.setState(s);
  api.migrateState('2.1.1');
  assert.equal(api.getState().logs[d].countsAsPeriod, false);
});

test('Setup placeholder does not drag the average period length to one day', () => {
  const s = structuredClone(api.defaultState);
  s.settings.typicalPeriodLength = 5;
  const first = relDay(-60);
  // Shape of the log that setup created before 2.1.1: no sexualActivity field.
  s.logs = { [first]: { date: first, bleeding: 'medium', countsAsPeriod: true, symptoms: [], moods: [], notes: '' } };
  for (let i = 0; i < 6; i++) { const d = relDay(-32 + i); s.logs[d] = dayLog(d, 'medium'); }
  api.setState(s);
  api.migrateState('2.1.0');
  assert.equal(api.averagePeriodLength(), 6);
});

test('Only placeholder history falls back to the configured period length', () => {
  const s = structuredClone(api.defaultState);
  s.settings.typicalPeriodLength = 5;
  s.settings.recentPeriodStart = relDay(-40);
  s.logs = {};
  api.setState(s);
  api.setRecentPeriodStart(relDay(-20));
  assert.equal(api.averagePeriodLength(), 5);
});

test('Changing the period start in settings moves the prediction', () => {
  const s = structuredClone(api.defaultState);
  s.settings.typicalCycleLength = 28;
  s.settings.recentPeriodStart = relDay(-40);
  s.logs = {};
  api.setState(s);
  api.setRecentPeriodStart(relDay(-40));
  const before = api.cycleData().latestStart;
  api.setRecentPeriodStart(relDay(-5));
  const out = api.getState();
  assert.notEqual(api.cycleData().latestStart, before);
  assert.equal(api.cycleData().latestStart, relDay(-5));
  assert.equal(out.logs[relDay(-40)], undefined, 'old placeholder should be removed');
});

test('Changing the period start keeps a real entry on the old date', () => {
  const s = structuredClone(api.defaultState);
  const old = relDay(-40);
  s.settings.recentPeriodStart = old;
  s.logs = { [old]: dayLog(old, 'heavy', { notes: 'real entry' }) };
  api.setState(s);
  api.setRecentPeriodStart(relDay(-5));
  assert.equal(api.getState().logs[old].notes, 'real entry');
});

test('Version comparison orders patch releases', () => {
  assert(api.compareVersions('2.1.0', '2.1.1') < 0);
  assert(api.compareVersions('2.10.0', '2.9.9') > 0);
  assert.equal(api.compareVersions('2.1.1', '2.1.1'), 0);
});

console.log(`\n${passed} core tests passed.`);
