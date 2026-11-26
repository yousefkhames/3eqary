/* 3eqary core logic: pure functions, no DOM. Works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DAY = 86400000;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }
  function monthKey(d) { return (typeof d === 'string' ? d : iso(d)).slice(0, 7); }
  function addMonths(key, n) {
    var p = key.split('-'), t = (+p[0]) * 12 + (+p[1] - 1) + n;
    return Math.floor(t / 12) + '-' + pad((t % 12) + 1);
  }
  function monthsBetween(a, b) { var x = a.split('-'), y = b.split('-'); return (+y[0] - +x[0]) * 12 + (+y[1] - +x[1]); }
  function daysInMonth(key) { var p = key.split('-'); return new Date(+p[0], +p[1], 0).getDate(); }
  function dueDate(unit, month) {
    var d = Math.min(Math.max(1, +unit.dueDay || 1), daysInMonth(month));
    return month + '-' + pad(d);
  }
  function diffDays(a, b) { return Math.round((parse(a) - parse(b)) / DAY); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function num(v) { var n = parseFloat(v); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; }

  function isOccupied(u) { return !!(u.tenant && String(u.tenant).trim()); }

  function paidFor(state, unitId, month) {
    return state.payments.reduce(function (s, p) {
      return p.unitId === unitId && p.month === month ? s + (+p.amount || 0) : s;
    }, 0);
  }

  /* Is `month` inside the contract span? Missing start = from 12 months ago is not assumed: no start => only current/future. */
  function inContract(unit, month) {
    if (!isOccupied(unit)) return false;
    if (unit.start && month < monthKey(unit.start)) return false;
    if (unit.end && month > monthKey(unit.end)) return false;
    return true;
  }

  function rentStatus(unit, state, month, today) {
    if (!inContract(unit, month)) return { code: 'none', due: 0, paid: 0, left: 0 };
    var rent = +unit.rent || 0, paid = paidFor(state, unit.id, month), left = Math.max(0, rent - paid);
    var dd = dueDate(unit, month), late = diffDays(today, dd);
    var code;
    if (rent > 0 && paid >= rent) code = 'paid';
    else if (late > 0) code = paid > 0 ? 'partial-late' : 'overdue';
    else if (paid > 0) code = 'partial';
    else if (late >= -5) code = 'soon';
    else code = 'upcoming';
    return { code: code, due: rent, paid: paid, left: left, dueDate: dd, lateDays: Math.max(0, late) };
  }

  function arrears(unit, state, today) {
    if (!isOccupied(unit)) return { total: 0, months: [] };
    var cur = monthKey(today), first = unit.start ? monthKey(unit.start) : cur;
    if (monthsBetween(first, cur) > 36) first = addMonths(cur, -36);
    var months = [], total = 0;
    for (var m = first; m <= cur; m = addMonths(m, 1)) {
      var s = rentStatus(unit, state, m, today);
      if ((s.code === 'overdue' || s.code === 'partial-late') && s.left > 0) { months.push({ month: m, left: s.left }); total += s.left; }
    }
    return { total: Math.round(total * 100) / 100, months: months };
  }

  function contractStatus(unit, today, warnDays) {
    warnDays = warnDays || 60;
    if (!isOccupied(unit)) return { code: 'vacant' };
    if (!unit.end) return { code: 'open' };
    var left = diffDays(unit.end, today);
    if (left < 0) return { code: 'expired', days: -left };
    if (left <= warnDays) return { code: 'expiring', days: left };
    return { code: 'active', days: left };
  }

  function summary(state, month, today) {
    var expected = 0, collected = 0, overdue = 0, occupied = 0, vacant = 0, rows = [];
    state.units.forEach(function (u) {
      if (isOccupied(u)) occupied++; else vacant++;
      var s = rentStatus(u, state, month, today);
      if (s.code === 'none') return;
      expected += s.due; collected += Math.min(s.paid, s.due || s.paid);
      if (s.code === 'overdue' || s.code === 'partial-late') overdue += s.left;
      rows.push({ unit: u, status: s });
    });
    var rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    return { expected: expected, collected: collected, outstanding: Math.max(0, expected - collected), overdue: overdue, occupied: occupied, vacant: vacant, rate: rate, rows: rows };
  }

  /* Auto reminders, sorted by urgency then date. */
  function buildReminders(state, today) {
    var out = [], cur = monthKey(today);
    state.units.forEach(function (u) {
      if (!isOccupied(u)) return;
      var s = rentStatus(u, state, cur, today);
      if (s.code === 'overdue' || s.code === 'partial-late') out.push({ kind: 'overdue', unitId: u.id, date: s.dueDate, days: s.lateDays, amount: s.left, sev: 0 });
      else if (s.code === 'soon') out.push({ kind: 'due', unitId: u.id, date: s.dueDate, days: -diffDays(today, s.dueDate), amount: s.left, sev: 2 });
      var a = arrears(u, state, today);
      var older = a.months.filter(function (x) { return x.month < cur; });
      if (older.length) out.push({ kind: 'arrears', unitId: u.id, date: dueDate(u, older[0].month), days: older.length, amount: older.reduce(function (t, x) { return t + x.left; }, 0), sev: 0 });
      var c = contractStatus(u, today);
      if (c.code === 'expiring') out.push({ kind: 'expiring', unitId: u.id, date: u.end, days: c.days, sev: 1 });
      if (c.code === 'expired') out.push({ kind: 'expired', unitId: u.id, date: u.end, days: c.days, sev: 1 });
    });
    state.tickets.forEach(function (t) {
      if (t.status !== 'done' && t.priority === 'high') out.push({ kind: 'urgent-ticket', unitId: t.unitId, ticketId: t.id, date: t.date, title: t.title, sev: 1 });
    });
    out.sort(function (a, b) { return a.sev - b.sev || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0); });
    return out;
  }

  function maintenanceStats(state) {
    var open = 0, prog = 0, done = 0, cost = 0;
    state.tickets.forEach(function (t) {
      if (t.status === 'done') { done++; cost += +t.cost || 0; } else if (t.status === 'progress') prog++; else open++;
    });
    return { open: open, progress: prog, done: done, cost: cost };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsDate(s) { return s.replace(/-/g, ''); }
  /* Calendar file: rent due days (monthly), contract ends, custom reminders. */
  function toICS(state, today, labels) {
    labels = labels || {};
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//3eqary//EN', 'CALSCALE:GREGORIAN'];
    function ev(id, date, title, rrule) {
      L.push('BEGIN:VEVENT', 'UID:' + id + '@3eqary', 'DTSTAMP:' + icsDate(today) + 'T000000Z', 'DTSTART;VALUE=DATE:' + icsDate(date), 'SUMMARY:' + esc(title));
      if (rrule) L.push(rrule);
      L.push('END:VEVENT');
    }
    state.units.forEach(function (u) {
      if (!isOccupied(u)) return;
      var m = monthKey(today);
      if (u.end && monthKey(u.end) < m) { /* finished */ } else {
        var until = u.end ? ';UNTIL=' + icsDate(u.end) : '';
        ev('rent-' + u.id, dueDate(u, m), (labels.rent || 'Rent due') + ': ' + u.name + ' (' + u.tenant + ')', 'RRULE:FREQ=MONTHLY' + until);
      }
      if (u.end) ev('end-' + u.id, u.end, (labels.end || 'Contract ends') + ': ' + u.name, null);
    });
    state.reminders.forEach(function (r) { if (!r.done && r.date) ev('rem-' + r.id, r.date, r.title, null); });
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  }

  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function paymentsCSV(state) {
    var names = {}; state.units.forEach(function (u) { names[u.id] = u; });
    var rows = [['date', 'month', 'unit', 'tenant', 'amount', 'note']];
    state.payments.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (p) {
      var u = names[p.unitId] || {};
      rows.push([p.date, p.month, u.name || '', u.tenant || '', p.amount, p.note || '']);
    });
    return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  function emptyState() { return { v: 1, lang: 'ar', currency: 'EGP', units: [], payments: [], tickets: [], reminders: [] }; }

  /* Validate and normalise imported JSON. Throws on bad input. */
  function normalize(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad-file');
    var s = emptyState();
    ['units', 'payments', 'tickets', 'reminders'].forEach(function (k) {
      if (obj[k] !== undefined && !Array.isArray(obj[k])) throw new Error('bad-file');
      s[k] = (obj[k] || []).filter(function (x) { return x && typeof x === 'object' && x.id; });
    });
    if (!Array.isArray(obj.units) && !Array.isArray(obj.payments)) throw new Error('bad-file');
    s.lang = obj.lang === 'en' ? 'en' : 'ar';
    s.currency = typeof obj.currency === 'string' && obj.currency.length <= 5 ? obj.currency : 'EGP';
    if (typeof obj.owner === 'string') s.owner = obj.owner.slice(0, 60);
    var ids = {}; s.units.forEach(function (u) { ids[u.id] = 1; });
    s.payments = s.payments.filter(function (p) { return ids[p.unitId] && /^\d{4}-\d{2}$/.test(p.month); });
    s.tickets = s.tickets.filter(function (t) { return ids[t.unitId]; });
    return s;
  }

  function sampleState(today) {
    var cur = monthKey(today), pm = addMonths(cur, -1), d = function (m, day) { return m + '-' + pad(day); };
    var u = [
      { id: 'u1', name: 'شقة 3 - الدور الثاني', address: 'شارع الجيش، الإسكندرية', tenant: 'محمود السيد', phone: '01001234567', rent: 3500, dueDay: 1, start: d(addMonths(cur, -8), 1), end: d(addMonths(cur, 4), 1), deposit: 7000, notes: 'يدفع نقدًا', files: [] },
      { id: 'u2', name: 'شقة 5 - الدور الثالث', address: 'شارع الجيش، الإسكندرية', tenant: 'هالة إبراهيم', phone: '01119876543', rent: 4200, dueDay: 5, start: d(addMonths(cur, -3), 5), end: d(addMonths(cur, 1), 20), deposit: 8400, notes: '', files: [] },
      { id: 'u3', name: 'محل أرضي', address: 'ميدان المنشية', tenant: 'مكتبة النور', phone: '01224445566', rent: 6000, dueDay: 10, start: d(addMonths(cur, -14), 10), end: d(addMonths(cur, 9), 10), deposit: 12000, notes: 'تجديد سنوي', files: [] },
      { id: 'u4', name: 'استوديو 1', address: 'سموحة', tenant: '', phone: '', rent: 2800, dueDay: 1, start: '', end: '', deposit: 0, notes: 'جاهز للتأجير', files: [] }
    ];
    var pay = [], n = 0;
    function P(unitId, month, amount) { pay.push({ id: 'p' + (++n), unitId: unitId, month: month, amount: amount, date: d(month, 3), note: '' }); }
    for (var i = 7; i >= 1; i--) P('u1', addMonths(cur, -i), 3500);
    P('u1', cur, 3500);
    for (var j = 3; j >= 2; j--) P('u2', addMonths(cur, -j), 4200);
    P('u2', pm, 2000);
    for (var k = 13; k >= 1; k--) P('u3', addMonths(cur, -k), 6000);
    var tk = [
      { id: 't1', unitId: 'u2', title: 'تسريب في حوض المطبخ', priority: 'high', status: 'open', cost: 0, date: d(cur, 1), note: '' },
      { id: 't2', unitId: 'u1', title: 'تغيير لمبات الطرقة', priority: 'low', status: 'progress', cost: 120, date: d(pm, 20), note: '' },
      { id: 't3', unitId: 'u3', title: 'صيانة التكييف', priority: 'medium', status: 'done', cost: 650, date: d(pm, 8), note: '' }
    ];
    return { v: 1, lang: 'ar', currency: 'EGP', units: u, payments: pay, tickets: tk, reminders: [{ id: 'r1', title: 'تجديد عقد الكهرباء', date: d(addMonths(cur, 0), 28), done: false, unitId: '' }] };
  }

  return { iso: iso, parse: parse, monthKey: monthKey, addMonths: addMonths, monthsBetween: monthsBetween, daysInMonth: daysInMonth, dueDate: dueDate, diffDays: diffDays, uid: uid, num: num, isOccupied: isOccupied, paidFor: paidFor, inContract: inContract, rentStatus: rentStatus, arrears: arrears, contractStatus: contractStatus, summary: summary, buildReminders: buildReminders, maintenanceStats: maintenanceStats, toICS: toICS, paymentsCSV: paymentsCSV, emptyState: emptyState, normalize: normalize, sampleState: sampleState };
});
