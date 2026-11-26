const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../logic.js');
const T = '2026-11-15';
const mk = (o) => Object.assign({ id: 'a', name: 'A', tenant: 'X', rent: 1000, dueDay: 1, start: '2026-01-01', end: '2027-06-30' }, o);
const st = (units, payments = [], extra = {}) => Object.assign({ units, payments, tickets: [], reminders: [] }, extra);

test('month helpers', () => {
  assert.equal(L.addMonths('2026-11', 3), '2027-02');
  assert.equal(L.addMonths('2026-01', -2), '2025-11');
  assert.equal(L.monthsBetween('2025-11', '2026-02'), 3);
  assert.equal(L.daysInMonth('2028-02'), 29);
  assert.equal(L.dueDate({ dueDay: 31 }, '2026-02'), '2026-02-28');
  assert.equal(L.diffDays('2026-03-01', '2026-02-28'), 1);
});
test('rent status codes', () => {
  const u = mk({});
  assert.equal(L.rentStatus(u, st([u]), '2026-11', T).code, 'overdue');
  assert.equal(L.rentStatus(u, st([u], [{ unitId: 'a', month: '2026-11', amount: 1000 }]), '2026-11', T).code, 'paid');
  assert.equal(L.rentStatus(u, st([u], [{ unitId: 'a', month: '2026-11', amount: 400 }]), '2026-11', T).code, 'partial-late');
  assert.equal(L.rentStatus(u, st([u]), '2026-12', T).code, 'upcoming');
  assert.equal(L.rentStatus(mk({ dueDay: 18 }), st([u]), '2026-11', T).code, 'soon');
  assert.equal(L.rentStatus(mk({ dueDay: 25 }), st([u], [{ unitId: 'a', month: '2026-11', amount: 10 }]), '2026-11', T).code, 'partial');
  assert.equal(L.rentStatus(u, st([u]), '2025-12', T).code, 'none');
  assert.equal(L.rentStatus(mk({ tenant: '' }), st([u]), '2026-11', T).code, 'none');
});
test('overpay counts as paid, left is zero', () => {
  const u = mk({});
  const s = L.rentStatus(u, st([u], [{ unitId: 'a', month: '2026-11', amount: 1500 }]), '2026-11', T);
  assert.equal(s.code, 'paid'); assert.equal(s.left, 0);
});
test('arrears accumulate over months', () => {
  const u = mk({ start: '2026-09-01' });
  const a = L.arrears(u, st([u], [{ unitId: 'a', month: '2026-09', amount: 1000 }, { unitId: 'a', month: '2026-10', amount: 250 }]), T);
  assert.equal(a.total, 750 + 1000);
  assert.deepEqual(a.months.map(m => m.month), ['2026-10', '2026-11']);
});
test('contract status', () => {
  assert.equal(L.contractStatus(mk({ end: '2026-12-20' }), T).code, 'expiring');
  assert.equal(L.contractStatus(mk({ end: '2026-12-20' }), T).days, 35);
  assert.equal(L.contractStatus(mk({ end: '2026-11-10' }), T).code, 'expired');
  assert.equal(L.contractStatus(mk({ end: '2028-01-01' }), T).code, 'active');
  assert.equal(L.contractStatus(mk({ end: '' }), T).code, 'open');
  assert.equal(L.contractStatus(mk({ tenant: '' }), T).code, 'vacant');
});
test('summary totals and rate', () => {
  const a = mk({ id: 'a' }), b = mk({ id: 'b', rent: 3000 }), c = mk({ id: 'c', tenant: '' });
  const s = L.summary(st([a, b, c], [{ unitId: 'a', month: '2026-11', amount: 1000 }, { unitId: 'b', month: '2026-11', amount: 1000 }]), '2026-11', T);
  assert.equal(s.expected, 4000); assert.equal(s.collected, 2000); assert.equal(s.outstanding, 2000);
  assert.equal(s.rate, 50); assert.equal(s.occupied, 2); assert.equal(s.vacant, 1); assert.equal(s.overdue, 2000);
});
test('reminders ordering and kinds', () => {
  const a = mk({ id: 'a', end: '2026-12-01' });
  const s = st([a], [], { tickets: [{ id: 't', unitId: 'a', title: 'leak', priority: 'high', status: 'open', date: '2026-11-01' }, { id: 't2', unitId: 'a', priority: 'high', status: 'done', date: '2026-11-01' }] });
  const r = L.buildReminders(s, T);
  const kinds = r.map(x => x.kind);
  assert.ok(kinds.includes('overdue') && kinds.includes('expiring') && kinds.includes('urgent-ticket'));
  assert.equal(kinds.filter(k => k === 'urgent-ticket').length, 1);
  assert.equal(r[0].sev, 0);
});
test('maintenance stats', () => {
  const s = st([], [], { tickets: [{ status: 'open' }, { status: 'progress' }, { status: 'done', cost: 100 }, { status: 'done', cost: '50' }] });
  assert.deepEqual(L.maintenanceStats(s), { open: 1, progress: 1, done: 2, cost: 150 });
});
test('ics output', () => {
  const a = mk({ id: 'a', end: '2027-01-10' });
  const ics = L.toICS(st([a], [], { reminders: [{ id: 'r', title: 'Pay, bill', date: '2026-11-20', done: false }, { id: 'r2', title: 'x', date: '2026-11-21', done: true }] }), T);
  assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /RRULE:FREQ=MONTHLY;UNTIL=20270110/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261101/); assert.match(ics, /Pay\\, bill/); assert.doesNotMatch(ics, /SUMMARY:x/);
  assert.ok(ics.endsWith('END:VCALENDAR'));
});
test('csv escapes', () => {
  const a = mk({ id: 'a', name: 'Flat "1", A' });
  const csv = L.paymentsCSV(st([a], [{ unitId: 'a', month: '2026-11', amount: 5, date: '2026-11-02', note: 'x' }]));
  assert.match(csv, /"Flat ""1"", A"/); assert.ok(csv.startsWith('\ufeffdate'));
});
test('normalize import', () => {
  assert.throws(() => L.normalize(null)); assert.throws(() => L.normalize([])); assert.throws(() => L.normalize({ foo: 1 }));
  const s = L.normalize({ units: [{ id: 'a' }, { nope: 1 }], payments: [{ id: 'p', unitId: 'a', month: '2026-11' }, { id: 'q', unitId: 'zz', month: '2026-11' }, { id: 'r', unitId: 'a', month: 'bad' }], lang: 'en' });
  assert.equal(s.units.length, 1); assert.equal(s.payments.length, 1); assert.equal(s.lang, 'en'); assert.deepEqual(s.tickets, []);
});
test('sample data is coherent', () => {
  const s = L.sampleState(T), n = L.normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(n.units.length, 4); assert.equal(n.payments.length, s.payments.length);
  assert.ok(L.buildReminders(s, T).length >= 3);
  const sm = L.summary(s, '2026-11', T); assert.ok(sm.expected > 0 && sm.rate <= 100);
});
test('num parsing', () => { assert.equal(L.num('12.345'), 12.35); assert.equal(L.num('-5'), 0); assert.equal(L.num('abc'), 0); });
