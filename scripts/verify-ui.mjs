import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { projectId } from '../src/project-id.js';
import { owner } from '../src/data.js';

const base = process.env.TEST_URL || 'http://127.0.0.1:4185/';
const projects = JSON.parse(await readFile(new URL('../projects.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../src/screenshots.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const device = devices['iPhone 16 Pro Max'];
  const context = await browser.newContext({ ...device, viewport: device.screen });
  await context.route(url => url.origin !== new URL(base).origin, route => route.fulfill({ contentType: 'text/html', body: '<title>Project destination</title>' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('link', { name: 'Browser', exact: true }).click();
  assert.equal(await page.locator('#view-browser .app-row').count(), projects.length);
  await page.getByRole('link', { name: 'Likes', exact: true }).click();
  assert.equal(await page.locator('#view-likes .app-row').count(), projects.length);
  assert.equal(await page.locator('.badge').innerText(), String(projects.length));
  await page.getByRole('heading', { name: 'Likes You', exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('link', { name: 'Chats', exact: true }).click();
  await page.locator('#view-chats').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.conversation-row').count(), 0);
  assert.equal(await page.locator('.nav-button[aria-label="Chats"] .chat-dot').count(), 0);
  assert.match(await page.locator('#view-chats').innerText(), /Your next conversation starts with a like/);
  const openExternalControl = async (label, url) => {
    const opened = context.waitForEvent('page');
    await page.getByRole('link', { name: label, exact: true }).click();
    const tab = await opened;
    await tab.waitForLoadState('domcontentloaded');
    assert.equal(tab.url(), url);
    assert.equal(await tab.evaluate(() => window.opener), null);
    await tab.close();
    await page.waitForFunction(() => document.querySelector('.swipe-deck')?.dataset.phase === 'idle');
  };
  const openApp = async name => {
    await page.getByRole('link', { name: 'Browser', exact: true }).click();
    await page.locator('#view-browser .app-row').filter({ hasText: name }).click();
    await page.waitForURL('**/#home');
    assert.ok((await page.locator('#app-name').innerText()).includes(name));
    const project = projects.find(project => project.name === name);
    assert.equal(await page.locator('#app-name .age').innerText(), `’${project.firstCommitDate.slice(2, 4)}`);
    assert.equal(await page.locator('#view-home .profile-copy a').count(), 0);
    const website = page.locator('.actions .superlike');
    if (project.websiteUrl) {
      assert.equal(await website.getAttribute('href'), project.websiteUrl);
      assert.equal(await website.getAttribute('target'), '_blank');
    } else {
      assert.ok(await website.isDisabled());
      await openExternalControl('Share', project.githubUrl);
      assert.ok((await page.locator('#app-name').innerText()).includes(name));
    }
    assert.equal(await page.locator('.actions .share').getAttribute('href'), project.githubUrl);
    assert.equal(await page.locator('.actions .share').getAttribute('target'), '_blank');
  };
  for (const project of projects) await openApp(project.name);
  await openApp(projects[0].name);
  const picture = page.locator('#view-home [data-front] .screenshot-artwork img');
  await picture.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#view-home [data-front] .screenshot-artwork img')?.naturalWidth === 1320);
  assert.deepEqual(await picture.evaluate(img => [img.naturalWidth, img.naturalHeight]), [1320, 2868]);
  await page.screenshot({ path: '/private/tmp/bff-home.png' });
  const checkCounts = async (matches, pending) => {
    await page.getByRole('link', { name: 'Likes', exact: true }).click();
    await page.locator('#view-likes').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#view-likes .app-row').count(), pending);
    assert.equal(await page.locator('.badge').innerText(), String(pending));
    await page.getByRole('link', { name: 'Chats', exact: true }).click();
    await page.locator('#view-chats').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.conversation-row').count(), matches);
    assert.equal(await page.locator('.nav-button[aria-label="Chats"] .chat-dot').count(), matches > 0 ? 1 : 0);
  };
  await openExternalControl('Share', projects[0].githubUrl);
  assert.equal(await page.locator('.match-popup').count(), 0);
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  const popup = page.locator('.match-popup');
  await popup.waitFor({ state: 'visible' });
  assert.equal(await popup.locator('strong').innerText(), 'You matched!');
  assert.equal(await popup.locator('span').innerText(), projects[0].name);
  assert.deepEqual(await popup.evaluate(box => box.getAnimations().map(animation => {
    const { duration, delay } = animation.effect.getTiming();
    return [animation.animationName, duration, delay];
  })), [['match-pop-in', 250, 0], ['match-pop-out', 250, 1750]]);
  assert.equal(await popup.evaluate(box => getComputedStyle(box).pointerEvents), 'none');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.match-popup')).opacity === '1');
  await page.screenshot({ path: '/private/tmp/bff-match-popup.png' });
  await popup.waitFor({ state: 'detached', timeout: 3000 });
  await checkCounts(1, projects.length - 1);
  assert.equal(await page.locator('#view-likes .app-row').filter({ hasText: projects[0].name }).count(), 0);
  await page.locator('.conversation-row').click();
  await page.waitForURL(`**/#chats/${projectId(projects[0])}`);
  assert.equal(await page.locator('.thread-header h1').innerText(), projects[0].name);
  assert.equal(await page.locator('.message').count(), 3);
  assert.ok((await page.locator('.messages').innerText()).includes(projects[0].description));
  assert.equal(await page.locator('#view-chats a[href^="mailto:"]').count(), 0);
  await page.screenshot({ path: '/private/tmp/bff-chat-thread.png' });
  await page.locator('#view-chats a[href="#chats"]').click();
  await openApp(projects[1].name);
  await openExternalControl('Share', projects[1].githubUrl);
  await openExternalControl('Superlike', projects[1].websiteUrl);
  assert.equal(await popup.locator('span').innerText(), projects[1].name);
  assert.ok(!(await page.locator('#app-name').innerText()).includes(projects[1].name));
  await checkCounts(2, projects.length - 2);
  await page.screenshot({ path: '/private/tmp/bff-chats.png' });
  await page.getByRole('link', { name: 'Likes', exact: true }).click();
  await page.screenshot({ path: '/private/tmp/bff-likes.png' });
  await openApp(projects[1].name);
  await openExternalControl('Superlike', projects[1].websiteUrl);
  await checkCounts(2, projects.length - 2);
  await openApp(projects[0].name);
  await page.getByRole('button', { name: 'Pass', exact: true }).click();
  assert.equal(await popup.count(), 0);
  await checkCounts(1, projects.length - 2);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await popup.count(), 0);
  assert.ok((await page.locator('#app-name').innerText()).includes(projects[0].name));
  await checkCounts(2, projects.length - 2);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await checkCounts(2, projects.length - 2);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await checkCounts(1, projects.length - 1);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await checkCounts(0, projects.length);
  await openApp(projects[0].name);
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  await page.getByRole('link', { name: 'Chats', exact: true }).click();
  await page.locator('.conversation-row').click();
  await page.locator('#view-chats a[href="#profile"]').click();
  await page.locator('#view-profile').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#owner-name').innerText(), owner.name);
  assert.equal(await page.locator(`a[href="mailto:${owner.email}"]`).count(), 1);
  for (const { url } of owner.links) {
    assert.equal(await page.locator(`a[href="${url}"]`).count(), 1);
    assert.equal(await page.locator(`#view-profile a[href="${url}"]`).count(), 1);
  }
  assert.ok(await page.locator('#view-profile').isVisible());
  await page.waitForFunction(() => document.querySelector('.author-photo')?.naturalWidth === 1320);
  await page.screenshot({ path: '/private/tmp/bff-profile.png' });
  await page.goBack();
  await page.waitForURL(`**/#chats/${projectId(projects[0])}`);
  assert.ok(await page.locator('.thread-header').isVisible());
  for (const viewport of [{ width: 440, height: 956 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const nav = await page.locator('.navigation').boundingBox();
    assert.ok(nav.y >= 0 && nav.y + nav.height <= viewport.height);
    assert.equal(await page.locator('.badge').innerText(), String(projects.length - 1));
  }
  await page.reload();
  assert.ok(await page.locator('#view-chats').isVisible());
  assert.match(await page.locator('#view-chats').innerText(), /Your next conversation starts with a like/);
  assert.equal(await page.locator('.message').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Passed: five views, match popup timing and cleanup, live Likes You count, chat dot, matching, conversations, sample threads, undo, profile-only contacts, external links, years, navigation, and responsive layout.');

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
