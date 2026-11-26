/* Real-browser click-through. Usage: BASE=https://yousefkhames.github.io/3eqary/ node tests/e2e.js
   Needs playwright-core (PW_PATH to override) and a Chrome binary (CHROME, default /usr/bin/google-chrome). */
const { chromium } = require(process.env.PW_PATH || 'playwright-core');
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const BASE = (process.env.BASE || 'http://localhost:8099/').replace(/\/?$/, '/');
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs');
const TODAY = '2026-11-15';
let step = 0;
const ok = (m) => console.log('ok ' + (++step) + ' - ' + m);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, locale: 'ar-EG' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const noOverflow = async (label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow: ' + label);

  await page.goto(BASE + '?today=' + TODAY);
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl'); ok('loads in Arabic, RTL');
  assert.ok(await page.locator('.empty').isVisible()); ok('empty state shown');

  // add unit
  await page.click('[data-act=addunit]');
  await page.fill('input[name=name]', 'شقة 7');
  await page.fill('input[name=tenant]', 'سامي علي');
  await page.fill('input[name=phone]', '01012345678');
  await page.fill('input[name=rent]', '3000');
  await page.fill('input[name=dueDay]', '1');
  await page.fill('input[name=start]', '2026-09-01');
  await page.fill('input[name=end]', '2026-12-01');
  await page.click('#dlgBody button[type=submit]');
  await page.goto(BASE + '?today=' + TODAY + '#/units');
  assert.ok(await page.locator('.tag', { hasText: 'شقة 7' }).isVisible()); ok('unit added and listed');
  await page.click('.tag');
  assert.ok(await page.locator('text=ينتهي خلال').first().isVisible()); ok('contract expiring chip');

  // validation
  await page.click('[data-act=editunit]');
  await page.fill('input[name=end]', '2026-01-01');
  await page.click('#dlgBody button[type=submit]');
  assert.ok((await page.textContent('#dlgErr')).length > 3); ok('date validation blocks save');
  await page.click('#dlgCancel');

  // partial payment
  await page.click('[data-act=pay]');
  await page.fill('input[name=amount]', '1000');
  await page.click('#dlgBody button[type=submit]');
  assert.ok(await page.locator('.row', { hasText: /١٬٠٠٠|1,000/ }).first().isVisible()); ok('payment recorded in list');
  // receipt
  await page.click('[data-act=receipt]');
  assert.ok(await page.locator('.receipt').isVisible()); ok('receipt renders');
  await page.screenshot({ path: path.join(SHOTS, 'tmp-receipt.png') }); fs.unlinkSync(path.join(SHOTS, 'tmp-receipt.png'));
  await page.click('#dlgCancel');

  // file attach / open / delete
  const f = path.join(require('os').tmpdir(), 'contract.png');
  fs.writeFileSync(f, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await page.setInputFiles('#fileIn', f);
  await page.waitForSelector('.fileitem');
  assert.ok(await page.locator('.fileitem', { hasText: 'contract.png' }).isVisible()); ok('contract file attached');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('3eqary.v1')).units[0].files.length);
  assert.equal(stored, 1); ok('file persisted in localStorage');
  await page.reload(); await page.waitForSelector('.fileitem'); ok('file survives reload');
  await page.click('[data-act=delfile]');
  assert.equal(await page.locator('.fileitem').count(), 0); ok('file deleted');

  // maintenance
  await page.click('[data-act=addticket]');
  await page.fill('input[name=title]', 'تسريب مياه');
  await page.selectOption('select[name=priority]', 'high');
  await page.click('#dlgBody button[type=submit]');
  await page.goto(BASE + '?today=' + TODAY + '#/maint');
  assert.ok(await page.locator('.row', { hasText: 'تسريب مياه' }).isVisible()); ok('ticket visible in maintenance');
  await page.click('[data-act=nextticket]'); await page.click('[data-act=nextticket]');
  assert.ok(await page.locator('[data-act=nextticket]', { hasText: 'تم' }).isVisible()); ok('ticket cycles open > progress > done');

  // reminders
  await page.goto(BASE + '?today=' + TODAY + '#/rem');
  await page.click('[data-act=addrem]');
  await page.fill('input[name=title]', 'سداد فاتورة النور');
  await page.click('#dlgBody button[type=submit]');
  assert.ok(await page.locator('.row', { hasText: 'سداد فاتورة النور' }).isVisible()); ok('custom reminder added');
  await page.click('[data-act=toggrem]');
  assert.ok(await page.locator('.row b[style*=line-through]').isVisible()); ok('reminder marked done');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=ics]')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /RRULE:FREQ=MONTHLY/); ok('ICS export downloads a calendar file');

  // sample data + dashboard
  await page.goto(BASE + '?today=' + TODAY + '#/set');
  await page.click('[data-act=sample]');
  await page.goto(BASE + '?today=' + TODAY + '#/');
  assert.equal(await page.locator('.kpi').count(), 4);
  assert.ok(await page.locator('.alert').count() >= 3); ok('dashboard shows KPIs and alerts from sample data');
  await noOverflow('dashboard AR');
  await page.screenshot({ path: path.join(SHOTS, 'dashboard-ar.png'), fullPage: false });
  const before = await page.textContent('.month-pick b');
  await page.click('[data-act=mprev]');
  assert.notEqual(await page.textContent('.month-pick b'), before); ok('month navigation works');
  await page.click('[data-act=mnext]');
  await page.click('.row [data-act=pay]');
  await page.click('#dlgBody button[type=submit]');
  ok('quick payment from dashboard');

  // language switch
  await page.click('#langBtn');
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr'); assert.equal(await page.textContent('#langBtn'), 'عربي'); ok('switch to English flips to LTR');
  await noOverflow('dashboard EN');
  await page.screenshot({ path: path.join(SHOTS, 'dashboard-en.png') });
  await page.goto(BASE + '?today=' + TODAY + '#/units');
  await noOverflow('units EN');
  await page.screenshot({ path: path.join(SHOTS, 'units-en.png') });
  await page.click('.tag >> nth=0');
  await noOverflow('unit detail EN');
  await page.screenshot({ path: path.join(SHOTS, 'unit-en.png'), fullPage: true });

  // backup + restore
  await page.goto(BASE + '?today=' + TODAY + '#/set');
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=backup]')]);
  const bkPath = await bk.path(); const data = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
  assert.ok(data.units.length >= 4); ok('backup JSON contains units');
  await page.click('[data-act=wipe]');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('3eqary.v1')).units.length), 0); ok('wipe clears data');
  await page.setInputFiles('#restoreIn', bkPath);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('3eqary.v1')).units.length >= 4);
  ok('restore brings data back');
  const bad = path.join(require('os').tmpdir(), 'bad.json'); fs.writeFileSync(bad, '{"x":1}');
  await page.setInputFiles('#restoreIn', bad);
  await page.waitForSelector('#toast span');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('3eqary.v1')).units.length >= 4), true); ok('invalid backup rejected, data intact');

  // XSS safety
  await page.goto(BASE + '?today=' + TODAY + '#/units');
  await page.click('[data-act=addunit]');
  await page.fill('input[name=name]', '<img src=x onerror=window.__x=1>');
  await page.fill('input[name=rent]', '10');
  await page.click('#dlgBody button[type=submit]');
  assert.equal(await page.evaluate(() => window.__x), undefined); ok('HTML in names is escaped');

  // desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + '?today=' + TODAY + '#/');
  await noOverflow('desktop');
  await page.screenshot({ path: path.join(SHOTS, 'desktop-en.png') });
  ok('desktop layout has no overflow');

  assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | ')); ok('no console or page errors');
  await browser.close();
  console.log('E2E PASS (' + step + ' checks) against ' + BASE);
})().catch((e) => { console.error('E2E FAIL', e); process.exit(1); });
