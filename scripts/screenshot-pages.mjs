import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { apps, copy } from '../src/data.js';
import { views } from '../src/navigation.js';

const base = process.env.TEST_URL || 'http://127.0.0.1:5173/';
const output = new URL('../docs/screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const device = devices['iPhone 16 Pro Max'];
  const page = await browser.newPage({ ...device, viewport: device.screen });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const navigate = async name => {
    await page.getByRole('link', { name, exact: true }).click();
    const view = views.find(view => view.label === name);
    await page.locator(`#view-${view.id}`).waitFor({ state: 'visible' });
  };
  const capture = async name => {
    await page.locator('section:not([hidden]) img').evaluateAll(images => Promise.all(images.filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    }).map(img => img.decode())));
    await page.screenshot({ path: new URL(`${name}.jpg`, output).pathname, type: 'jpeg', quality: 85, scale: 'css' });
    console.log(`Captured ${name}`);
  };
  await page.goto(base);
  await capture('home');
  await navigate(copy.navigation.browser);
  assert.equal(await page.locator('#view-browser .app-row').count(), apps.length);
  await capture('browser');
  await navigate(copy.navigation.likes);
  await capture('likes');
  await navigate(copy.navigation.chats);
  assert.equal(await page.locator('.conversation-row').count(), 0);
  await capture('chats-empty');

  await navigate(copy.navigation.home);
  await page.getByRole('button', { name: copy.actions.like, exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.swipe-deck').dataset.phase === 'idle'
    && getComputedStyle(document.querySelector('.match-popup')).opacity === '1');
  assert.equal(await page.locator('.match-popup span').innerText(), apps[0].name);
  await capture('match');
  await page.locator('.match-popup').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: copy.actions.like, exact: true }).click();
  await page.locator('.match-popup').waitFor({ state: 'detached' });

  await navigate(copy.navigation.chats);
  assert.equal(await page.locator('.conversation-row').count(), 2);
  assert.equal(await page.locator('.badge').innerText(), String(apps.length - 2));
  assert.ok(await page.locator('.chat-dot').isVisible());
  await capture('chats');
  await page.locator('.conversation-row').first().click();
  await page.locator('.thread-header').waitFor({ state: 'visible' });
  await capture('chat-thread');
  await navigate(copy.navigation.profile);
  await capture('profile');
  assert.deepEqual(errors, []);
  console.log(`Saved eight page screenshots to ${output.pathname}`);
} finally {
  await browser.close();
}
