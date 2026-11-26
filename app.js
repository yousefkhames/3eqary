/* 3eqary UI. Everything runs in the browser; data in localStorage. */
(function () {
  'use strict';
  var L = window.Logic, KEY = '3eqary.v1', MAX_FILE = 700 * 1024;
  var qs = new URLSearchParams(location.search);
  var fakeToday = /^\d{4}-\d{2}-\d{2}$/.test(qs.get('today') || '') ? qs.get('today') : null;
  function today() { return fakeToday || L.iso(new Date()); }

  var S = load(), month = L.monthKey(today()), tickFilter = 'all';

  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return L.normalize(JSON.parse(raw)); } catch (e) { /* corrupt: start clean */ }
    var s = L.emptyState();
    if (!/^ar/i.test(navigator.language || 'ar')) s.lang = 'en';
    return s;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
    catch (e) { toast(t('storage_full')); return false; }
  }
  function t(k, v) {
    var s = (I18N[S.lang] && I18N[S.lang][k]) || I18N.en[k] || k;
    if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function loc() { return S.lang === 'ar' ? 'ar-EG' : 'en-GB'; }
  function money(n) { return new Intl.NumberFormat(loc(), { maximumFractionDigits: 2 }).format(n || 0) + ' ' + esc(S.currency); }
  function num(n) { return new Intl.NumberFormat(loc()).format(n); }
  function dateFmt(s) { if (!s) return '-'; return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', year: 'numeric' }).format(L.parse(s)); }
  function monthFmt(m) { return new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' }).format(L.parse(m + '-01')); }
  function monthShort(m) { return new Intl.DateTimeFormat(loc(), { month: 'narrow' }).format(L.parse(m + '-01')); }
  function unitById(id) { return S.units.filter(function (u) { return u.id === id; })[0]; }
  function toast(msg) {
    var el = document.getElementById('toast'); el.innerHTML = '<span>' + esc(msg) + '</span>';
    clearTimeout(toast.h); toast.h = setTimeout(function () { el.innerHTML = ''; }, 2400);
  }
  function $(s, r) { return (r || document).querySelector(s); }

  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/></svg>',
    units: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/></svg>',
    maint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/></svg>',
    rem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    set: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    key: '<svg viewBox="0 0 64 64" fill="none" stroke="#b8862b" stroke-width="4" stroke-linecap="round"><circle cx="22" cy="32" r="12"/><path d="M34 32h24m-8 0v10m-8-10v7"/></svg>'
  };

  /* ---------- routing ---------- */
  function route() { var h = location.hash.replace(/^#\/?/, ''); return h.split('/'); }
  function render() {
    document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    $('#brandTag').textContent = t('tag'); $('#langBtn').textContent = S.lang === 'ar' ? 'English' : 'عربي';
    document.title = S.lang === 'ar' ? 'عقاري | 3eqary' : '3eqary | Landlord manager';
    var r = route(), page = r[0] || 'home';
    var alerts = L.buildReminders(S, today()).filter(function (x) { return x.sev < 2; }).length;
    var tabs = [['home', '#/', 'nav_home'], ['units', '#/units', 'nav_units'], ['maint', '#/maint', 'nav_maint'], ['rem', '#/rem', 'nav_rem'], ['set', '#/set', 'nav_set']];
    var cur = page === 'unit' ? 'units' : page;
    $('#tabs').innerHTML = tabs.map(function (x) {
      return '<a href="' + x[1] + '"' + (x[0] === cur ? ' aria-current="page"' : '') + '>' + ICON[x[0]] + '<span>' + t(x[2]) + '</span>' +
        (x[0] === 'rem' && alerts ? '<em class="dot" style="font-style:normal">' + num(alerts) + '</em>' : '') + '</a>';
    }).join('');
    var v = $('#view');
    if (page === 'units') v.innerHTML = viewUnits();
    else if (page === 'unit' && unitById(r[1])) v.innerHTML = viewUnit(unitById(r[1]));
    else if (page === 'maint') v.innerHTML = viewMaint();
    else if (page === 'rem') v.innerHTML = viewRem();
    else if (page === 'set') v.innerHTML = viewSet();
    else v.innerHTML = viewHome();
  }

  /* ---------- helpers for views ---------- */
  function chip(code, label) { return '<span class="chip c-' + code + '">' + esc(label) + '</span>'; }
  function statusChip(s) { return chip(s.code, t('st_' + s.code)); }
  function contractText(c) { return t('ct_' + c.code, { n: num(c.days || 0) }); }
  function remText(r) {
    var u = unitById(r.unitId), un = u ? u.name : '';
    var v = { u: esc(un), n: num(r.days || 0), a: money(r.amount), t: esc(r.title || '') };
    if (r.kind === 'due' && r.days === 0) return t('rm_due0', v);
    var k = { overdue: 'rm_overdue', due: 'rm_due', arrears: 'rm_arrears', expiring: 'rm_expiring', expired: 'rm_expired', 'urgent-ticket': 'rm_urgent' }[r.kind];
    return t(k, v);
  }
  function ledgerStrip(u, big) {
    var cur = L.monthKey(today()), out = '';
    for (var i = 11; i >= 0; i--) {
      var m = L.addMonths(cur, -i), s = L.rentStatus(u, S, m, today());
      var cls = s.code === 'paid' ? 'paid' : (s.code === 'overdue' || s.code === 'partial-late') ? 'late' : s.code === 'partial' ? 'part' : s.code === 'soon' ? 'soon' : '';
      out += '<i class="' + cls + '" title="' + esc(monthFmt(m)) + ': ' + esc(t('st_' + s.code)) + '">' + (big ? monthShort(m) : '') + '</i>';
    }
    return '<div class="strip' + (big ? ' big' : '') + '" dir="ltr" role="img" aria-label="' + esc(t('ledger')) + '">' + out + '</div>';
  }

  /* ---------- views ---------- */
  function viewHome() {
    if (!S.units.length) return emptyUnits();
    var sm = L.summary(S, month, today()), rems = L.buildReminders(S, today()).filter(function (x) { return x.sev < 2 || true; }).slice(0, 5);
    var h = '<div class="page-head"><h1>' + t('nav_home') + '</h1><div class="month-pick"><button type="button" data-act="mprev" aria-label="prev">' + (S.lang === 'ar' ? '&rarr;' : '&larr;') + '</button><b>' + esc(monthFmt(month)) + '</b><button type="button" data-act="mnext" aria-label="next">' + (S.lang === 'ar' ? '&larr;' : '&rarr;') + '</button></div></div>';
    h += '<div class="grid kpis">' +
      '<div class="card kpi"><small>' + t('expected') + '</small><b>' + money(sm.expected) + '</b></div>' +
      '<div class="card kpi ok"><small>' + t('collected') + '</small><b>' + money(sm.collected) + '</b></div>' +
      '<div class="card kpi ' + (sm.overdue > 0 ? 'bad' : '') + '"><small>' + t('outstanding') + '</small><b>' + money(sm.outstanding) + '</b></div>' +
      '<div class="card kpi"><small>' + t('occupancy') + '</small><b>' + num(sm.occupied) + '/' + num(S.units.length) + '</b></div></div>';
    h += '<div class="card sec"><div class="meter" role="progressbar" aria-valuenow="' + sm.rate + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + sm.rate + '%"></i></div><div class="muted">' + (sm.expected ? t('collected_of', { p: num(sm.rate) }) : t('no_rent_month')) + '</div></div>';
    h += '<div class="grid two sec"><div class="card"><h2>' + t('rent_this_month') + '</h2>';
    if (!sm.rows.length) h += '<p class="muted">' + t('no_rent_month') + '</p>';
    sm.rows.forEach(function (r) {
      var u = r.unit, s = r.status;
      h += '<div class="row"><div class="grow"><b><a href="#/unit/' + u.id + '" style="text-decoration:none;color:inherit">' + esc(u.name) + '</a></b><small>' + esc(u.tenant) + ' · ' + t('due_on', { d: num(u.dueDay || 1) }) + '</small></div>' +
        '<div style="text-align:end"><div class="amt">' + money(s.paid) + ' / ' + money(s.due) + '</div>' + statusChip(s) + '</div>' +
        (s.left > 0 ? '<button class="btn sm" type="button" data-act="pay" data-id="' + u.id + '" data-month="' + month + '">' + t('record_payment') + '</button>' : '') + '</div>';
    });
    h += '</div><div class="card"><h2>' + t('attention') + '</h2>';
    if (!rems.length) h += '<p class="muted">' + t('all_good') + '</p>';
    rems.forEach(function (r) { h += '<div class="alert s' + r.sev + '"><div class="grow">' + remText(r) + '</div></div>'; });
    h += '</div></div>';
    return h;
  }

  function emptyUnits() {
    return '<div class="card empty">' + ICON.key + '<h2>' + t('units_empty_t') + '</h2><p>' + t('units_empty_d') + '</p><div class="btns" style="justify-content:center"><button class="btn brass" type="button" data-act="addunit">' + t('add_unit') + '</button><button class="btn ghost" type="button" data-act="sample">' + t('load_sample') + '</button></div></div>';
  }

  function viewUnits() {
    if (!S.units.length) return emptyUnits();
    var h = '<div class="page-head"><h1>' + t('nav_units') + '</h1><button class="btn" type="button" data-act="addunit">+ ' + t('add_unit') + '</button></div><div class="grid cards">';
    S.units.forEach(function (u) {
      var occ = L.isOccupied(u), s = L.rentStatus(u, S, L.monthKey(today()), today()), c = L.contractStatus(u, today());
      h += '<a class="card tag' + (occ ? '' : ' vac') + '" href="#/unit/' + u.id + '" style="text-decoration:none;color:inherit"><h3>' + esc(u.name) + '</h3>' +
        '<div class="who">' + (occ ? esc(u.tenant) : t('vacant')) + (u.address ? ' · ' + esc(u.address) : '') + '</div>' +
        '<div class="meta"><span class="amt">' + money(u.rent) + ' <small class="muted">' + t('per_month') + '</small></span>' + (occ ? statusChip(s) : chip('vacant', t('vacant'))) + '</div>' +
        (occ ? '<div class="meta" style="margin-top:6px"><small class="muted">' + esc(contractText(c)) + '</small></div>' + ledgerStrip(u) : '') + '</a>';
    });
    return h + '</div>';
  }

  function viewUnit(u) {
    var occ = L.isOccupied(u), c = L.contractStatus(u, today()), ar = L.arrears(u, S, today());
    var pays = S.payments.filter(function (p) { return p.unitId === u.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var total = pays.reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
    var tk = S.tickets.filter(function (x) { return x.unitId === u.id; });
    var h = '<div class="page-head"><div><a href="#/units" class="muted">&larr;&nbsp;' + t('nav_units') + '</a><h1>' + esc(u.name) + '</h1></div><div class="btns">' +
      (occ ? '<button class="btn brass" type="button" data-act="pay" data-id="' + u.id + '" data-month="' + L.monthKey(today()) + '">' + t('record_payment') + '</button>' : '') +
      '<button class="btn ghost" type="button" data-act="editunit" data-id="' + u.id + '">' + t('edit') + '</button></div></div>';
    h += '<div class="grid two"><div class="card"><dl class="info">' +
      '<dt>' + t('tenant') + '</dt><dd>' + (occ ? esc(u.tenant) : t('vacant')) + '</dd>' +
      (u.phone ? '<dt>' + t('phone') + '</dt><dd dir="ltr" style="text-align:start">' + esc(u.phone) + ' <a class="btn sm ghost" href="tel:' + esc(u.phone) + '">' + t('call') + '</a> <a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/' + esc(waNum(u.phone)) + '">' + t('wa') + '</a></dd>' : '') +
      (u.address ? '<dt>' + t('address') + '</dt><dd>' + esc(u.address) + '</dd>' : '') +
      '<dt>' + t('rent') + '</dt><dd>' + money(u.rent) + '</dd><dt>' + t('due_day') + '</dt><dd>' + num(u.dueDay || 1) + '</dd>' +
      '<dt>' + t('start') + '</dt><dd>' + dateFmt(u.start) + '</dd><dt>' + t('end') + '</dt><dd>' + dateFmt(u.end) + (occ ? ' ' + chip(c.code, contractText(c)) : '') + '</dd>' +
      '<dt>' + t('deposit') + '</dt><dd>' + money(u.deposit) + '</dd>' +
      (u.notes ? '<dt>' + t('notes') + '</dt><dd>' + esc(u.notes) + '</dd>' : '') + '</dl></div>' +
      '<div class="card"><h2>' + t('ledger') + '</h2>' + ledgerStrip(u, true) +
      '<p class="muted" style="margin:10px 0 0">' + t('total_paid') + ': <b>' + money(total) + '</b>' + (ar.total ? ' · <span style="color:var(--bad)">' + t('arrears') + ': <b>' + money(ar.total) + '</b></span>' : '') + '</p></div></div>';
    h += '<div class="card sec"><h2>' + t('payments') + '</h2>';
    if (!pays.length) h += '<p class="muted">' + t('no_payments') + '</p>';
    pays.forEach(function (p) {
      h += '<div class="row"><div class="grow"><b>' + esc(monthFmt(p.month)) + '</b><small>' + dateFmt(p.date) + (p.note ? ' · ' + esc(p.note) : '') + '</small></div><span class="amt">' + money(p.amount) + '</span>' +
        '<button class="btn sm ghost" type="button" data-act="receipt" data-id="' + p.id + '">' + t('receipt') + '</button>' +
        '<button class="btn sm danger" type="button" data-act="delpay" data-id="' + p.id + '" aria-label="' + t('delete') + '">&times;</button></div>';
    });
    h += '</div><div class="card sec"><div class="page-head" style="margin:0 0 6px"><h2 style="margin:0">' + t('contract_files') + '</h2><label class="btn sm ghost" style="cursor:pointer">+ ' + t('add_file') + '<input type="file" id="fileIn" data-id="' + u.id + '" accept="image/*,.pdf,.doc,.docx" hidden></label></div>';
    if (!(u.files || []).length) h += '<p class="muted">' + t('no_files') + '</p>';
    (u.files || []).forEach(function (f) {
      var ext = (f.name.split('.').pop() || 'file').slice(0, 4).toUpperCase();
      h += '<div class="fileitem"><span class="ico">' + esc(ext) + '</span><div class="grow" style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.name) + '</b><small class="muted">' + Math.round(f.size / 1024) + ' KB</small></div>' +
        '<button class="btn sm ghost" type="button" data-act="openfile" data-id="' + u.id + '" data-fid="' + f.id + '">' + t('open') + '</button>' +
        '<button class="btn sm danger" type="button" data-act="delfile" data-id="' + u.id + '" data-fid="' + f.id + '" aria-label="' + t('delete') + '">&times;</button></div>';
    });
    h += '<p class="hint" style="margin:8px 0 0">' + t('file_total_warn') + '</p></div>';
    h += '<div class="card sec"><div class="page-head" style="margin:0 0 6px"><h2 style="margin:0">' + t('maint') + '</h2><button class="btn sm ghost" type="button" data-act="addticket" data-unit="' + u.id + '">+ ' + t('add_ticket') + '</button></div>';
    if (!tk.length) h += '<p class="muted">' + t('no_tickets') + '</p>';
    tk.forEach(function (x) { h += ticketRow(x, true); });
    h += '</div>';
    if (occ) h += '<div class="sec"><button class="btn danger" type="button" data-act="endtenancy" data-id="' + u.id + '">' + t('end_tenant') + '</button> </div>';
    h += '<div class="sec"><button class="btn danger" type="button" data-act="delunit" data-id="' + u.id + '">' + t('delete') + ' ' + esc(u.name) + '</button></div>';
    return h;
  }
  function waNum(p) { var d = String(p).replace(/\D/g, ''); if (/^0\d{10}$/.test(d)) d = '2' + d; return d; }

  function ticketRow(x, hideUnit) {
    var u = unitById(x.unitId);
    return '<div class="row"><div class="grow"><b>' + esc(x.title) + '</b><small>' + (hideUnit || !u ? '' : esc(u.name) + ' · ') + dateFmt(x.date) + (+x.cost ? ' · ' + money(x.cost) : '') + (x.note ? ' · ' + esc(x.note) : '') + '</small></div>' +
      chip(x.priority, t('pr_' + x.priority)) +
      '<button class="btn sm ' + (x.status === 'done' ? 'ghost' : '') + '" type="button" data-act="nextticket" data-id="' + x.id + '" title="' + t('move_next') + '">' + t('ts_' + x.status) + '</button>' +
      '<button class="btn sm ghost" type="button" data-act="editticket" data-id="' + x.id + '" aria-label="' + t('edit') + '">&#9998;</button></div>';
  }

  function viewMaint() {
    var st = L.maintenanceStats(S);
    var h = '<div class="page-head"><h1>' + t('maint') + '</h1><button class="btn" type="button" data-act="addticket">+ ' + t('add_ticket') + '</button></div>';
    h += '<div class="grid kpis"><div class="card kpi"><small>' + t('ts_open') + '</small><b>' + num(st.open) + '</b></div><div class="card kpi"><small>' + t('ts_progress') + '</small><b>' + num(st.progress) + '</b></div><div class="card kpi ok"><small>' + t('ts_done') + '</small><b>' + num(st.done) + '</b></div><div class="card kpi"><small>' + t('maint_cost') + '</small><b>' + money(st.cost) + '</b></div></div>';
    h += '<div class="seg sec" role="group">' + ['all', 'open', 'progress', 'done'].map(function (f) { return '<button type="button" data-act="filt" data-f="' + f + '" aria-pressed="' + (tickFilter === f) + '">' + (f === 'all' ? t('all') : t('ts_' + f)) + '</button>'; }).join('') + '</div>';
    var list = S.tickets.filter(function (x) { return tickFilter === 'all' || x.status === tickFilter; }).sort(function (a, b) {
      var w = { high: 0, medium: 1, low: 2 }; return (a.status === 'done') - (b.status === 'done') || w[a.priority] - w[b.priority] || (a.date < b.date ? 1 : -1);
    });
    h += '<div class="card">' + (list.length ? list.map(function (x) { return ticketRow(x); }).join('') : '<p class="muted">' + t('no_tickets') + '</p>') + '</div>';
    return h;
  }

  function viewRem() {
    var auto = L.buildReminders(S, today());
    var h = '<div class="page-head"><h1>' + t('reminders') + '</h1><div class="btns"><button class="btn ghost" type="button" data-act="ics">' + t('export_ics') + '</button><button class="btn" type="button" data-act="addrem">+ ' + t('add_rem') + '</button></div></div>';
    h += '<div class="card"><h2>' + t('auto_rem') + '</h2>' + (auto.length ? auto.map(function (r) { return '<div class="alert s' + r.sev + '"><div class="grow">' + remText(r) + '<div class="hint">' + dateFmt(r.date) + '</div></div>' + (r.unitId ? '<a class="btn sm ghost" href="#/unit/' + r.unitId + '">' + t('open') + '</a>' : '') + '</div>'; }).join('') : '<p class="muted">' + t('all_good') + '</p>') + '</div>';
    var mine = S.reminders.slice().sort(function (a, b) { return (a.done) - (b.done) || (a.date < b.date ? -1 : 1); });
    h += '<div class="card sec"><h2>' + t('my_rem') + '</h2>' + (mine.length ? mine.map(function (r) {
      var late = !r.done && r.date && r.date < today();
      return '<div class="row"><div class="grow"><b style="' + (r.done ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(r.title) + '</b><small' + (late ? ' style="color:var(--bad)"' : '') + '>' + dateFmt(r.date) + '</small></div>' +
        '<button class="btn sm ' + (r.done ? 'ghost' : '') + '" type="button" data-act="toggrem" data-id="' + r.id + '">' + (r.done ? '&#10003; ' : '') + t('done') + '</button><button class="btn sm danger" type="button" data-act="delrem" data-id="' + r.id + '" aria-label="' + t('delete') + '">&times;</button></div>';
    }).join('') : '<p class="muted">' + t('no_rem') + '</p>') + '</div>';
    return h;
  }

  function viewSet() {
    return '<div class="page-head"><h1>' + t('settings') + '</h1></div><div class="card"><div class="two-f"><label class="f">' + t('language') + '<select id="setLang"><option value="ar"' + (S.lang === 'ar' ? ' selected' : '') + '>العربية</option><option value="en"' + (S.lang === 'en' ? ' selected' : '') + '>English</option></select></label>' +
      '<label class="f">' + t('currency') + '<input id="setCur" maxlength="5" value="' + esc(S.currency) + '"></label></div>' +
      '<label class="f">' + t('owner_name') + '<input id="setOwner" value="' + esc(S.owner || '') + '"></label></div>' +
      '<div class="card sec"><h2>' + t('data') + '</h2><p class="muted">' + t('local_note') + '</p><div class="btns">' +
      '<button class="btn" type="button" data-act="backup">' + t('backup') + '</button><label class="btn ghost" style="cursor:pointer">' + t('restore') + '<input type="file" id="restoreIn" accept="application/json,.json" hidden></label>' +
      '<button class="btn ghost" type="button" data-act="csv">' + t('csv') + '</button><button class="btn ghost" type="button" data-act="sample">' + t('load_sample') + '</button><button class="btn danger" type="button" data-act="wipe">' + t('wipe') + '</button></div></div>' +
      '<p class="hint sec">' + t('about_demo') + '</p>';
  }

  /* ---------- dialog ---------- */
  var dlg = $('#dlg'), onSubmit = null;
  function field(name, label, val, type, extra) {
    type = type || 'text';
    if (type === 'textarea') return '<label class="f">' + label + '<textarea name="' + name + '" rows="2">' + esc(val) + '</textarea></label>';
    return '<label class="f">' + label + '<input name="' + name + '" type="' + type + '" value="' + esc(val == null ? '' : val) + '" ' + (extra || '') + '></label>';
  }
  function select(name, label, opts, val) {
    return '<label class="f">' + label + '<select name="' + name + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function openDlg(title, body, submit, extraBtns) {
    $('#dlgTitle').textContent = title;
    $('#dlgBody').innerHTML = body + '<p class="err" id="dlgErr" role="alert"></p><div class="btns"><button class="btn" type="submit">' + t('save') + '</button><button class="btn ghost" type="button" id="dlgCancel">' + t('cancel') + '</button>' + (extraBtns || '') + '</div>';
    onSubmit = submit; if (!dlg.open) dlg.showModal();
    $('#dlgCancel').onclick = closeDlg;
    var first = $('#dlgBody input:not([type=hidden]),#dlgBody select'); if (first && matchMedia('(pointer:fine)').matches) first.focus();
  }
  function closeDlg() { onSubmit = null; if (dlg.open) dlg.close(); }
  function formData() { var o = {}; new FormData($('#dlgForm')).forEach(function (v, k) { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; }
  function err(m) { $('#dlgErr').textContent = m; return false; }
  $('#dlgX').onclick = closeDlg;
  $('#dlgForm').addEventListener('submit', function (e) { e.preventDefault(); if (onSubmit) { var r = onSubmit(formData()); if (r !== false) closeDlg(); } });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDlg(); });

  function unitForm(u) {
    u = u || { name: '', address: '', tenant: '', phone: '', rent: '', dueDay: 1, start: today(), end: '', deposit: '', notes: '' };
    openDlg(u.id ? t('edit') : t('add_unit'),
      field('name', t('unit_name'), u.name, 'text', 'required maxlength="60"') + field('address', t('address'), u.address, 'text', 'maxlength="100"') +
      field('tenant', t('tenant'), u.tenant, 'text', 'maxlength="60"') + field('phone', t('phone'), u.phone, 'tel', 'inputmode="tel" dir="ltr"') +
      '<div class="two-f">' + field('rent', t('rent'), u.rent, 'number', 'min="0" step="any" inputmode="decimal" required') + field('dueDay', t('due_day'), u.dueDay, 'number', 'min="1" max="31" inputmode="numeric"') + '</div>' +
      '<div class="two-f">' + field('start', t('start'), u.start, 'date') + field('end', t('end'), u.end, 'date') + '</div>' +
      field('deposit', t('deposit'), u.deposit, 'number', 'min="0" step="any" inputmode="decimal"') + field('notes', t('notes'), u.notes, 'textarea'),
      function (d) {
        if (!d.name) return err(t('name_req'));
        var rent = L.num(d.rent); if (!rent) return err(t('rent_req'));
        if (d.start && d.end && d.end < d.start) return err(t('date_bad'));
        var rec = { name: d.name, address: d.address, tenant: d.tenant, phone: d.phone, rent: rent, dueDay: Math.min(31, Math.max(1, parseInt(d.dueDay, 10) || 1)), start: d.start, end: d.end, deposit: L.num(d.deposit), notes: d.notes };
        if (u.id) Object.assign(u, rec); else S.units.push(Object.assign({ id: L.uid(), files: [] }, rec));
        if (save()) toast(t('saved')); render();
      });
  }

  function payForm(unitId, m) {
    var u = unitById(unitId), s = L.rentStatus(u, S, m, today()), cur = L.monthKey(today());
    var opts = []; for (var i = -3; i <= 2; i++) opts.push([L.addMonths(cur, i), monthFmt(L.addMonths(cur, i))]);
    if (!opts.some(function (o) { return o[0] === m; })) opts.push([m, monthFmt(m)]);
    opts.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    openDlg(t('record_payment') + ': ' + u.name,
      select('month', t('pay_month'), opts, m) + '<div class="two-f">' + field('amount', t('pay_amount'), s.left || u.rent, 'number', 'min="0" step="any" inputmode="decimal" required') + field('date', t('pay_date'), today(), 'date', 'required') + '</div>' + field('note', t('pay_note'), '', 'text', 'maxlength="80"'),
      function (d) {
        var a = L.num(d.amount); if (!a) return err(t('amt_req'));
        S.payments.push({ id: L.uid(), unitId: u.id, month: d.month, amount: a, date: d.date || today(), note: d.note });
        if (save()) toast(t('saved')); render();
      });
  }

  function ticketForm(tk, unitId) {
    if (!S.units.length) { toast(t('need_unit')); return; }
    tk = tk || { title: '', unitId: unitId || S.units[0].id, priority: 'medium', status: 'open', cost: '', date: today(), note: '' };
    openDlg(tk.id ? t('edit') : t('add_ticket'),
      select('unitId', t('unit'), S.units.map(function (u) { return [u.id, u.name]; }), tk.unitId) + field('title', t('ticket_title'), tk.title, 'text', 'required maxlength="90"') +
      '<div class="two-f">' + select('priority', t('priority'), ['high', 'medium', 'low'].map(function (p) { return [p, t('pr_' + p)]; }), tk.priority) + select('status', t('status'), ['open', 'progress', 'done'].map(function (p) { return [p, t('ts_' + p)]; }), tk.status) + '</div>' +
      '<div class="two-f">' + field('cost', t('cost'), tk.cost, 'number', 'min="0" step="any" inputmode="decimal"') + field('date', t('ticket_date'), tk.date, 'date') + '</div>' + field('note', t('notes'), tk.note, 'textarea'),
      function (d) {
        if (!d.title) return err(t('ticket_title'));
        var rec = { unitId: d.unitId, title: d.title, priority: d.priority, status: d.status, cost: L.num(d.cost), date: d.date || today(), note: d.note };
        if (tk.id) Object.assign(tk, rec); else S.tickets.push(Object.assign({ id: L.uid() }, rec));
        if (save()) toast(t('saved')); render();
      }, tk.id ? '<button class="btn danger" type="button" id="dlgDel">' + t('delete') + '</button>' : '');
    var del = $('#dlgDel'); if (del) del.onclick = function () { if (confirm(t('del_q'))) { S.tickets = S.tickets.filter(function (x) { return x.id !== tk.id; }); save(); closeDlg(); render(); toast(t('deleted')); } };
  }

  function remForm() {
    openDlg(t('add_rem'), field('title', t('rem_title'), '', 'text', 'required maxlength="90"') + field('date', t('rem_date'), today(), 'date', 'required'),
      function (d) { if (!d.title) return err(t('rem_title')); S.reminders.push({ id: L.uid(), title: d.title, date: d.date, done: false, unitId: '' }); if (save()) toast(t('saved')); render(); });
  }

  function showReceipt(p) {
    var u = unitById(p.unitId) || {};
    var html = '<div class="receipt"><h3>' + t('receipt_title') + '</h3><div style="display:flex;justify-content:space-between"><span>' + t('receipt_no') + ' ' + esc(p.id.slice(-5).toUpperCase()) + '</span><span>' + dateFmt(p.date) + '</span></div>' +
      '<p>' + t('received_from') + ' <b>' + esc(u.tenant || '-') + '</b></p><div class="big">' + money(p.amount) + '</div>' +
      '<p>' + t('for_month') + ' <b>' + esc(monthFmt(p.month)) + '</b><br>' + t('for_unit') + ': <b>' + esc(u.name || '') + '</b>' + (u.address ? ' (' + esc(u.address) + ')' : '') + '</p>' + (p.note ? '<p>' + esc(p.note) + '</p>' : '') +
      '<div class="sig"><span>' + t('landlord_sig') + (S.owner ? ': ' + esc(S.owner) : '') + '</span></div></div>';
    $('#dlgTitle').textContent = t('receipt');
    $('#dlgBody').innerHTML = html + '<div class="btns" style="margin-top:12px"><button class="btn" type="button" id="doPrint">' + t('print') + '</button><button class="btn ghost" type="button" id="dlgCancel">' + t('close') + '</button></div>';
    onSubmit = null; if (!dlg.open) dlg.showModal();
    $('#dlgCancel').onclick = closeDlg;
    $('#doPrint').onclick = function () { $('#print-area').innerHTML = html; window.print(); };
  }

  /* ---------- downloads ---------- */
  function download(name, mime, text) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: mime }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function openDataUrl(f) {
    var a = document.createElement('a'); a.href = f.data; a.download = f.name; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act, id = b.dataset.id;
    var A = {
      mprev: function () { month = L.addMonths(month, -1); render(); },
      mnext: function () { month = L.addMonths(month, 1); render(); },
      addunit: function () { unitForm(); },
      editunit: function () { unitForm(unitById(id)); },
      sample: function () {
        if (S.units.length && !confirm(t('wipe_q'))) return;
        var lang = S.lang, cur = S.currency; S = L.sampleState(today()); S.lang = lang; S.currency = cur; save(); render(); toast(t('saved'));
      },
      pay: function () { payForm(id, b.dataset.month); },
      receipt: function () { var p = S.payments.filter(function (x) { return x.id === id; })[0]; if (p) showReceipt(p); },
      delpay: function () { if (confirm(t('del_q'))) { S.payments = S.payments.filter(function (x) { return x.id !== id; }); save(); render(); toast(t('deleted')); } },
      delunit: function () {
        if (!confirm(t('del_q'))) return;
        S.units = S.units.filter(function (u) { return u.id !== id; }); S.payments = S.payments.filter(function (p) { return p.unitId !== id; }); S.tickets = S.tickets.filter(function (x) { return x.unitId !== id; });
        save(); location.hash = '#/units'; render(); toast(t('deleted'));
      },
      endtenancy: function () { if (!confirm(t('end_tenant_q'))) return; var u = unitById(id); u.tenant = ''; u.phone = ''; u.start = ''; u.end = ''; save(); render(); toast(t('saved')); },
      openfile: function () { var f = (unitById(id).files || []).filter(function (x) { return x.id === b.dataset.fid; })[0]; if (f) openDataUrl(f); },
      delfile: function () { if (!confirm(t('del_q'))) return; var u = unitById(id); u.files = u.files.filter(function (x) { return x.id !== b.dataset.fid; }); save(); render(); toast(t('deleted')); },
      addticket: function () { ticketForm(null, b.dataset.unit); },
      editticket: function () { ticketForm(S.tickets.filter(function (x) { return x.id === id; })[0]); },
      nextticket: function () { var x = S.tickets.filter(function (y) { return y.id === id; })[0]; x.status = { open: 'progress', progress: 'done', done: 'open' }[x.status]; save(); render(); },
      filt: function () { tickFilter = b.dataset.f; render(); },
      addrem: remForm,
      toggrem: function () { var r = S.reminders.filter(function (x) { return x.id === id; })[0]; r.done = !r.done; save(); render(); },
      delrem: function () { S.reminders = S.reminders.filter(function (x) { return x.id !== id; }); save(); render(); },
      ics: function () { download('3eqary-reminders.ics', 'text/calendar', L.toICS(S, today(), { rent: S.lang === 'ar' ? 'استحقاق إيجار' : 'Rent due', end: S.lang === 'ar' ? 'انتهاء عقد' : 'Contract ends' })); },
      backup: function () { download('3eqary-backup-' + today() + '.json', 'application/json', JSON.stringify(S)); },
      csv: function () { download('3eqary-payments-' + today() + '.csv', 'text/csv;charset=utf-8', L.paymentsCSV(S)); },
      wipe: function () { if (confirm(t('wipe_q'))) { var lang = S.lang; S = L.emptyState(); S.lang = lang; save(); render(); toast(t('deleted')); } }
    };
    if (A[act]) A[act]();
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'setLang') { S.lang = el.value; save(); render(); }
    else if (el.id === 'setCur') { S.currency = (el.value.trim() || 'EGP').slice(0, 5); save(); toast(t('saved')); }
    else if (el.id === 'setOwner') { S.owner = el.value.trim().slice(0, 60); save(); toast(t('saved')); }
    else if (el.id === 'fileIn' && el.files[0]) {
      var f = el.files[0], u = unitById(el.dataset.id);
      if (f.size > MAX_FILE) { toast(t('file_big')); el.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () {
        u.files = u.files || []; u.files.push({ id: L.uid(), name: f.name, type: f.type, size: f.size, data: rd.result });
        if (!save()) u.files.pop(); render();
      };
      rd.readAsDataURL(f);
    } else if (el.id === 'restoreIn' && el.files[0]) {
      var rd2 = new FileReader();
      rd2.onload = function () {
        try { var n = L.normalize(JSON.parse(rd2.result)); n.owner = n.owner || S.owner; S = n; if (save()) toast(t('restored')); render(); }
        catch (x) { toast(t('bad_file')); }
      };
      rd2.readAsText(el.files[0]);
    }
  });
  $('#langBtn').onclick = function () { S.lang = S.lang === 'ar' ? 'en' : 'ar'; save(); render(); };
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
  render();
})();
