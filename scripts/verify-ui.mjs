import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:4185/';
const projects = JSON.parse(await readFile(new URL('../projects.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../src/screenshots.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const device = devices['iPhone 16 Pro Max'];
  const context = await browser.newContext({ ...device, viewport: device.screen });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('link', { name: 'Browser', exact: true }).click();
  assert.equal(await page.locator('#view-browser .app-row').count(), projects.length);
  const openApp = async name => {
    await page.getByRole('link', { name: 'Browser', exact: true }).click();
    await page.locator('#view-browser .app-row').filter({ hasText: name }).click();
    await page.waitForURL('**/#home');
    assert.ok((await page.locator('#app-name').innerText()).includes(name));
    const project = projects.find(project => project.name === name);
    assert.equal(await page.locator('#app-name .age').innerText(), project.firstCommitDate.slice(2, 4));
    assert.equal(await page.locator('#view-home .profile-copy a').count(), 0);
  };
  for (const project of projects) await openApp(project.name);
  await openApp(projects[0].name);
  const picture = page.locator('#view-home .screenshot-artwork img');
  await picture.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#view-home .screenshot-artwork img')?.naturalWidth === 1320);
  assert.deepEqual(await picture.evaluate(img => [img.naturalWidth, img.naturalHeight]), [1320, 2868]);
  await page.screenshot({ path: '/private/tmp/bff-home.png' });
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  await page.getByRole('link', { name: 'Likes', exact: true }).click();
  assert.equal(await page.locator('.phone').evaluate(phone => phone.scrollTop), 0);
  assert.equal(await page.locator('#view-likes .app-row').count(), 1);
  assert.match(await page.locator('#view-likes').innerText(), /Liked/);
  await openApp(projects[1].name);
  await page.getByRole('button', { name: 'Superlike', exact: true }).click();
  await page.getByRole('link', { name: 'Likes', exact: true }).click();
  assert.equal(await page.locator('#view-likes .app-row').count(), 2);
  assert.match(await page.locator('#view-likes').innerText(), /Superliked/);
  await page.screenshot({ path: '/private/tmp/bff-likes.png' });
  await page.locator('#view-likes .app-row').filter({ hasText: projects[0].name }).click();
  await page.getByRole('button', { name: 'Pass', exact: true }).click();
  await page.getByRole('link', { name: 'Likes', exact: true }).click();
  assert.equal(await page.locator('#view-likes .app-row').count(), 1);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.ok((await page.locator('#app-name').innerText()).includes(projects[0].name));
  await page.getByRole('link', { name: 'Likes', exact: true }).click();
  assert.equal(await page.locator('#view-likes .app-row').count(), 2);
  await page.getByRole('link', { name: 'Contact', exact: true }).click();
  assert.equal(await page.locator('#view-contact a[href="mailto:nicholasbennett.work@gmail.com"]').count(), 1);
  assert.equal(await page.locator('#view-contact a[href="https://github.com/nrrb/"]').count(), 1);
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  assert.equal(await page.locator('#owner-name').innerText(), 'Nicholas Bennett');
  await page.screenshot({ path: '/private/tmp/bff-profile.png' });
  await page.goBack();
  await page.waitForURL('**/#contact');
  assert.ok(await page.locator('#view-contact').isVisible());
  for (const viewport of [{ width: 440, height: 956 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const nav = await page.locator('.navigation').boundingBox();
    assert.ok(nav.y >= 0 && nav.y + nav.height <= viewport.height);
  }
  await page.reload();
  assert.ok(await page.locator('#view-contact').isVisible());
  assert.deepEqual(errors, []);
  console.log('Passed: five views, all projects, screenshots, like/superlike/pass/undo, contact/profile, browser Back, deep links, and responsive layout.');

  const gallery = await browser.newPage({ viewport: { width: 1540, height: 1000 }, deviceScaleFactor: 1 });
  await gallery.goto(base);
  await gallery.evaluate(({ captures, base }) => {
    document.body.replaceChildren();
    const style = document.createElement('style');
    style.textContent = 'body{margin:0;padding:15px;display:grid;grid-template-columns:repeat(7,1fr);gap:12px;background:#171c24;color:white;font:12px Arial}figure{margin:0;min-width:0}img{width:100%;height:440px;object-fit:contain;background:#080b0e}figcaption{height:32px;padding:8px 0}';
    document.head.append(style);
    for (const [id, capture] of Object.entries(captures)) {
      if (capture.status !== 'captured') continue;
      const figure = document.createElement('figure');
      const img = document.createElement('img');
      img.src = new URL(capture.file, base).href;
      const caption = document.createElement('figcaption');
      caption.textContent = id;
      figure.append(img, caption);
      document.body.append(figure);
    }
  }, { captures: manifest, base });
  await gallery.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth === 1320 && img.naturalHeight === 2868));
  await gallery.screenshot({ path: '/private/tmp/bff-project-contact-sheet.png', fullPage: true });
  console.log('All captured images loaded at 1320×2868; contact sheet: /private/tmp/bff-project-contact-sheet.png');
} finally {
  await browser.close();
}
