import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { projectId } from '../src/project-id.js';
import { apps, owner, copy } from '../src/data.js';

const base = process.env.TEST_URL || 'http://127.0.0.1:4185/';
const projects = apps;
const ids = projects.map(projectId);
const browser = await chromium.launch({ channel: 'chromium' });
const errors = [];

async function settled(page, id) {
  await page.locator('[data-front]').waitFor({ state: 'visible' });
  await page.waitForFunction(id => {
    const card = document.querySelector('[data-front]');
    return document.querySelector('.swipe-deck')?.dataset.phase === 'idle' && card?.dataset.appId === id
      && new DOMMatrix(getComputedStyle(card).transform).isIdentity;
  }, id);
}

async function startMouseDrag(page, dx, selector = '[data-front]', dy = 0) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2;
  const y = selector === '[data-front]' ? box.y + 100 : box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
}

async function noSwipeScrollbars(page) {
  const viewport = await page.locator('.view-content').evaluate(frame => {
    frame.scrollLeft = 100;
    frame.scrollTop = 100;
    const style = getComputedStyle(frame);
    return { overflow: [style.overflowX, style.overflowY], scroll: [frame.scrollLeft, frame.scrollTop] };
  });
  assert.deepEqual(viewport, { overflow: ['clip', 'clip'], scroll: [0, 0] });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight));
}


try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  await desktop.context().route(url => url.origin !== new URL(base).origin, route => route.fulfill({ contentType: 'text/html', body: '<title>Project destination</title>' }));
  desktop.on('pageerror', error => errors.push(error.message));
  await desktop.goto(base);
  await settled(desktop, ids[0]);
  assert.ok((await desktop.locator('.under-card h1').innerText()).includes(projects[1].name));
  assert.equal(await desktop.locator('.under-card').evaluate(card => getComputedStyle(card).filter), 'blur(4px)');
  await desktop.getByRole('link', { name: copy.navigation.browser, exact: true }).click();
  await desktop.locator('#view-browser').waitFor({ state: 'visible' });
  const listScroll = await desktop.locator('#view-browser').evaluate(list => { list.scrollTop = 300; return list.scrollTop; });
  assert.ok(listScroll > 0, 'App lists must still scroll independently');
  await desktop.getByRole('link', { name: copy.navigation.home, exact: true }).click();
  await settled(desktop, ids[0]);

  await startMouseDrag(desktop, 45, '#app-name');
  assert.notEqual(await desktop.locator('[data-front]').evaluate(card => new DOMMatrix(getComputedStyle(card).transform).b), 0);
  await noSwipeScrollbars(desktop);
  await desktop.mouse.up();
  await desktop.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('[data-front]')).transform).isIdentity);
  await settled(desktop, ids[0]);
  assert.ok(await desktop.getByRole('button', { name: copy.actions.undo, exact: true }).isDisabled());

  await startMouseDrag(desktop, -170);
  assert.equal(await desktop.locator('.swipe-stamp').innerText(), copy.card.passStamp);
  await noSwipeScrollbars(desktop);
  await desktop.screenshot({ path: '/private/tmp/bff-swipe-left.png' });
  await desktop.mouse.up();
  assert.equal(await desktop.locator('.swipe-deck').getAttribute('data-phase'), 'exit');
  await noSwipeScrollbars(desktop);
  await settled(desktop, ids[1]);
  await startMouseDrag(desktop, 350, '#app-name', 160);
  assert.equal(await desktop.locator('.swipe-stamp').innerText(), copy.card.likeStamp);
  await noSwipeScrollbars(desktop);
  await desktop.screenshot({ path: '/private/tmp/bff-swipe-right.png' });
  await desktop.mouse.up();
  await settled(desktop, ids[2]);
  assert.equal(await desktop.locator('.match-popup span').innerText(), projects[1].name);
  await desktop.getByRole('link', { name: copy.navigation.chats, exact: true }).click();
  await desktop.locator('#view-chats').waitFor({ state: 'visible' });
  assert.equal(await desktop.locator('.conversation-row').count(), 1);
  assert.ok((await desktop.locator('.conversation-row').innerText()).includes(projects[1].name));
  await desktop.getByRole('link', { name: copy.navigation.home, exact: true }).click();
  await settled(desktop, ids[2]);

  // Reduced motion lets the full queue and last-card checks run without repeated animations.
  await desktop.emulateMedia({ reducedMotion: 'reduce' });
  for (let index = 2; index < projects.length; index++) {
    await settled(desktop, ids[index]);
    await desktop.getByRole('button', { name: copy.actions.pass, exact: true }).click();
    await settled(desktop, ids[index + 1] || ids[0]);
  }
  assert.ok((await desktop.locator('.under-card h1').innerText()).includes(projects[2].name));
  await desktop.getByRole('button', { name: copy.actions.undo, exact: true }).click();
  await settled(desktop, ids.at(-1));
  let lastLiked;
  for (let index = 0; index < projects.length - 1; index++) {
    lastLiked = await desktop.locator('[data-front]').getAttribute('data-app-id');
    assert.notEqual(lastLiked, ids[1]);
    await desktop.getByRole('button', { name: copy.actions.like, exact: true }).click();
    await desktop.waitForFunction(() => document.querySelector('.swipe-deck').dataset.phase === 'idle');
  }
  assert.ok(await desktop.locator('.deck-empty').isVisible());
  assert.ok(await desktop.locator('.match-popup').evaluate(box => new DOMMatrix(getComputedStyle(box).transform).isIdentity), 'Reduced motion must not zoom the match popup');
  assert.equal(await desktop.locator('.badge').innerText(), '0');
  assert.ok(await desktop.getByRole('button', { name: copy.actions.like, exact: true }).isDisabled());
  await desktop.getByRole('button', { name: copy.actions.undo, exact: true }).click();
  await settled(desktop, lastLiked);
  await desktop.getByRole('button', { name: copy.actions.pass, exact: true }).click();
  await settled(desktop, lastLiked);
  assert.equal(await desktop.locator('.under-card').count(), 0);
  await desktop.getByRole('link', { name: copy.navigation.browser, exact: true }).click();
  await desktop.locator('#view-browser .app-row').filter({ hasText: projects[0].name }).click();
  await settled(desktop, ids[0]);
  const popup = desktop.context().waitForEvent('page');
  await desktop.getByRole('link', { name: copy.actions.superlike, exact: true }).click();
  const tab = await popup;
  await tab.waitForLoadState('domcontentloaded');
  assert.equal(tab.url(), projects[0].websiteUrl);
  await tab.close();
  await settled(desktop, lastLiked);
  await desktop.emulateMedia({ reducedMotion: 'no-preference' });
  await desktop.reload();
  await settled(desktop, ids[0]);
  await desktop.getByRole('button', { name: copy.actions.pass, exact: true }).press('Enter');
  assert.equal(await desktop.locator('.swipe-deck').getAttribute('data-phase'), 'exit');
  await settled(desktop, ids[1]);
  const appBounds = await desktop.locator('[data-front]').boundingBox();
  const copyPosition = await desktop.locator('[data-front] .profile-copy').evaluate(copy => {
    const style = getComputedStyle(copy);
    return [style.left, style.right, style.maxHeight];
  });
  await desktop.getByRole('link', { name: copy.navigation.profile, exact: true }).click();
  await desktop.locator('.author-card').waitFor({ state: 'visible' });
  const authorBounds = await desktop.locator('.author-card').boundingBox();
  assert.deepEqual(authorBounds, appBounds);
  assert.deepEqual(await desktop.locator('.author-copy').evaluate(copy => {
    const style = getComputedStyle(copy);
    return [style.left, style.right, style.maxHeight];
  }), copyPosition);
  assert.equal(await desktop.locator('.author-copy').evaluate(copy => getComputedStyle(copy).bottom), '16px');
  await startMouseDrag(desktop, -authorBounds.width * .8, '.author-photo');
  await desktop.mouse.up();
  assert.deepEqual(await desktop.locator('.author-card').boundingBox(), authorBounds);
  assert.equal(await desktop.locator('#view-profile img').count(), 1);
  assert.equal(await desktop.locator('#view-profile .likes-you').innerText(), copy.authorLabel);
  assert.equal(await desktop.locator('#view-profile button').count(), 0);
  await desktop.getByRole('link', { name: copy.navigation.home, exact: true }).click();
  await settled(desktop, ids[1]);

  const device = devices['iPhone 16 Pro Max'];
  const context = await browser.newContext({ ...device, viewport: device.screen });
  const mobile = await context.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base);
  await settled(mobile, ids[0]);
  const cdp = await context.newCDPSession(mobile);
  async function touchDrag(dx, dy = 0, selector = '[data-front]') {
    const box = await mobile.locator(selector).boundingBox();
    const x = box.x + box.width / 2;
    const y = selector === '.author-photo' ? box.y + 140 : selector === '[data-front]' ? box.y + 100 : box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 6, y: y + dy * step / 6, id: 1 }] });
    }
  }
  assert.equal(await mobile.locator('.card-stack').evaluate(stack => getComputedStyle(stack).touchAction), 'pan-y pinch-zoom');
  await touchDrag(50);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await settled(mobile, ids[0]);
  assert.ok(await mobile.getByRole('button', { name: copy.actions.undo, exact: true }).isDisabled());
  await touchDrag(2, 100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settled(mobile, ids[0]);
  assert.ok(await mobile.getByRole('button', { name: copy.actions.undo, exact: true }).isDisabled());
  await touchDrag(180, 10, '#app-name');
  await noSwipeScrollbars(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settled(mobile, ids[1]);
  await touchDrag(-180);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settled(mobile, ids[2]);
  await mobile.screenshot({ path: '/private/tmp/bff-mobile-deck.png' });
  const phone = await mobile.locator('.phone').boundingBox();
  const nav = await mobile.locator('.navigation').boundingBox();
  assert.equal(phone.width, 440);
  assert.equal(phone.height, 956);
  assert.ok(nav.y >= 0 && nav.y + nav.height <= 956);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.getByRole('link', { name: copy.navigation.chats, exact: true }).click();
  await mobile.locator('#view-chats').waitFor({ state: 'visible' });
  assert.equal(await mobile.locator('.conversation-row').count(), 1);
  assert.ok((await mobile.locator('.conversation-row').innerText()).includes(projects[0].name));
  await mobile.getByRole('link', { name: copy.navigation.profile, exact: true }).click();
  await mobile.locator('.author-card').waitFor({ state: 'visible' });
  const mobileAuthorBounds = await mobile.locator('.author-card').boundingBox();
  for (const direction of [-1, 1]) {
    await touchDrag(direction * mobileAuthorBounds.width * .4, 0, '.author-photo');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  assert.deepEqual(await mobile.locator('.author-card').boundingBox(), mobileAuthorBounds);
  assert.equal(new URL(mobile.url()).hash, '#profile');
  assert.equal(await mobile.locator('#view-profile img').count(), 1);
  await mobile.waitForFunction(() => document.querySelector('.author-photo')?.complete && document.querySelector('.author-photo').naturalWidth > 0);
  assert.deepEqual(await mobile.locator('.author-photo').evaluate(image => [image.naturalWidth, image.naturalHeight]), [owner.photo.width, owner.photo.height]);
  assert.equal(await mobile.locator('#view-profile .likes-you').innerText(), copy.authorLabel);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.screenshot({ path: '/private/tmp/bff-author-profile.png' });
  await mobile.getByRole('link', { name: copy.navigation.home, exact: true }).click();
  await settled(mobile, ids[2]);
  assert.deepEqual(errors, []);
  console.log('Passed: desktop/touch swipes, clipped exits, deck/match/undo edge cases, reduced motion, and single-photo author card, lowered profile text, bio links, fixed card boundaries, and unchanged app deck.');
} finally {
  await browser.close();
}
