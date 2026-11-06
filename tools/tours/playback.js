import { apps, owner } from '../../src/data.js';

async function clickOne(locator) {
  if (await locator.count() !== 1 || !await locator.isVisible() || !await locator.isEnabled() || await locator.getAttribute('aria-disabled') === 'true') throw new Error('Action is unavailable or target is ambiguous');
  await locator.click();
}

export async function settle(page) {
  await page.locator('.phone').waitFor();
  await page.waitForFunction(() => document.querySelector('.swipe-deck')?.dataset.phase === 'idle');
  await page.locator('.match-popup').waitFor({ state: 'detached' });
  await page.locator('section:not([hidden]) img').evaluateAll(images => Promise.all(images.filter(image => {
    const box = image.getBoundingClientRect();
    return box.bottom > 0 && box.top < innerHeight;
  }).map(image => image.decode())));
}

export async function playTour(page, steps, url, onStep = console.log) {
  const base = new URL(url);
  base.hash = 'home';
  let opened = false;
  let historyStart;
  // New windows are destination checks, not external browsing or extra recordings.
  await page.context().route(target => target.origin !== base.origin, route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<title>External destination</title>' })
    : route.continue());
  async function external(locator, expected) {
    if (!expected || await locator.count() !== 1 || !await locator.isVisible() || !await locator.isEnabled() || await locator.getAttribute('href') !== expected) throw new Error('External destination is missing or differs from configured content');
    const protocol = new URL(expected, base).protocol;
    if (protocol === 'mailto:') {
      await locator.evaluate(link => link.addEventListener('click', event => event.preventDefault(), { once: true }));
      await clickOne(locator);
      return;
    }
    if (!['https:', 'http:'].includes(protocol)) throw new Error('Only HTTP(S) and email destinations are supported');
    const popupPromise = page.waitForEvent('popup');
    await clickOne(locator);
    const popup = await popupPromise;
    try {
      await popup.waitForLoadState('domcontentloaded');
      if (popup.url() !== new URL(expected, base).href) throw new Error('New tab destination does not match configured content');
    } finally { await popup.close(); await popup.video()?.delete(); }
  }
  for (const step of steps) {
    try {
      onStep(`Line ${step.line}: ${step.text}`);
      if (step.id === 'open') {
        await page.goto(base.href);
        await page.reload();
        opened = true;
        historyStart = await page.evaluate(() => window.navigation.currentEntry.index);
      } else {
        if (!opened) throw new Error('Start the tour with Open app');
        if (step.id === 'wait') { await page.waitForTimeout(Number(step.value) * 1000); continue; }
        if (step.id.startsWith('view-')) {
          await clickOne(page.locator(`.navigation a[href="#${step.id.slice(5)}"]`));
        } else if (step.id.startsWith('swipe-')) {
          const card = page.locator('#view-home:not([hidden]) [data-front]');
          if (await card.count() !== 1) throw new Error('A current card on Home is required');
          const box = await card.boundingBox();
          const x = box.x + box.width / 2, y = box.y + 100;
          await page.mouse.move(x, y);
          await page.mouse.down();
          const direction = step.id === 'swipe-left' ? -1 : 1;
          for (let part = 1; part <= 10; part++) {
            await page.mouse.move(x + direction * box.width * .42 * part / 10, y);
            await page.waitForTimeout(35);
          }
          await page.mouse.up();
        } else if (step.id.startsWith('click-')) {
          const action = step.id.slice(6);
          const control = page.locator(`#view-home:not([hidden]) .actions .${action}`);
          if (['share', 'superlike'].includes(action)) {
            const id = await page.locator('[data-front]').getAttribute('data-app-id');
            const app = apps.find(item => item.id === id);
            await external(control, action === 'share' ? app?.githubUrl : app?.websiteUrl);
          } else await clickOne(control);
        } else if (step.id === 'project') {
          const matches = apps.filter(app => app.name === step.value);
          if (matches.length !== 1) throw new Error('Project name is missing or ambiguous');
          await clickOne(page.locator('.navigation a[href="#browser"]'));
          await clickOne(page.locator('#view-browser .app-row').filter({ has: page.getByText(step.value, { exact: true }) }));
        } else if (['first-conversation', 'conversation'].includes(step.id)) {
          const rows = page.locator('#view-chats:not([hidden]) .conversation-row');
          await clickOne(step.id === 'first-conversation' ? rows.first() : rows.filter({ has: page.getByText(step.value, { exact: true }) }));
        } else if (step.id === 'author') {
          await clickOne(page.locator('#view-chats:not([hidden]) a[href="#profile"]'));
        } else if (step.id === 'contact' || step.id === 'email') {
          const matches = step.id === 'email' ? [{ url: owner.email ? `mailto:${owner.email}` : null }] : owner.links.filter(link => link.label === step.value);
          if (matches.length !== 1 || !matches[0].url) throw new Error('Contact is missing or ambiguous');
          const locator = page.locator('#view-profile:not([hidden]) .contact-list').getByRole('link', {
            name: step.id === 'email' ? owner.email : `${step.value} ↗`, exact: true,
          });
          await external(locator, matches[0].url);
        } else if (step.id.startsWith('scroll-')) {
          const changed = await page.evaluate(direction => {
            const view = document.querySelector('section:not([hidden])');
            const element = view.id === 'view-home' ? view.querySelector('[data-front] .profile-copy') : view;
            if (!element) return false;
            const before = element.scrollTop;
            element.scrollTop += direction * element.clientHeight / 2;
            return element.scrollTop !== before;
          }, step.id === 'scroll-down' ? 1 : -1);
          if (!changed) throw new Error('No further scrolling is available');
        } else if (step.id === 'back') {
          const previous = await page.evaluate(start => window.navigation.entries().filter(entry => entry.index >= start && entry.index < window.navigation.currentEntry.index).at(-1)?.url, historyStart);
          if (!previous || new URL(previous).origin !== base.origin || new URL(previous).pathname !== base.pathname) throw new Error('No previous portfolio page in this tour');
          await page.goBack();
        }
      }
      await settle(page);
      await page.waitForTimeout(700);
    } catch (error) { throw new Error(`Line ${step.line} (${step.text}): ${error.message}`); }
  }
}
