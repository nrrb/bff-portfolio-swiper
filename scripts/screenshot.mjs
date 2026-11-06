import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { projectId } from '../src/project-id.js';

const projects = JSON.parse(await readFile(new URL('../projects.json', import.meta.url), 'utf8'));
const output = new URL('../public/project-screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const manifestPath = new URL('../src/screenshots.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const device = devices['iPhone 16 Pro Max'];
assert.deepEqual(device.screen, { width: 440, height: 956 });
const browser = await chromium.launch({ channel: 'chromium' });
const selected = new Set(process.argv.slice(2));
const pending = projects.filter(project => !selected.size || selected.has(projectId(project)));

async function capture(project) {
  const id = projectId(project);
  if (!project.websiteUrl) {
    manifest[id] = { status: 'unavailable', reason: 'No public website URL' };
    console.log(`${id}: no public website`);
    return;
  }
  const context = await browser.newContext({ ...device, viewport: device.screen, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    const response = await page.goto(project.websiteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? 'no response'}`);
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    if (id === 'medium-talk') {
      const onboarding = page.getByRole('button', { name: 'Got it', exact: true });
      if (await onboarding.isVisible()) await onboarding.click();
    }
    await page.waitForTimeout(1500);
    assert.deepEqual(page.viewportSize(), device.screen);
    assert.equal(await page.evaluate(() => devicePixelRatio), 3);
    await page.screenshot({ path: new URL(`${id}.jpg`, output).pathname, type: 'jpeg', quality: 85, fullPage: false, scale: 'device', timeout: 15000 });
    manifest[id] = { status: 'captured', file: `project-screenshots/${id}.jpg`, sourceUrl: project.websiteUrl, capturedUrl: page.url(), viewport: device.screen, width: 1320, height: 2868 };
    console.log(`${id}: captured 1320×2868`);
  } catch (error) {
    manifest[id] = { status: 'failed', sourceUrl: project.websiteUrl, reason: error.message.split('\n')[0] };
    console.error(`${id}: ${manifest[id].reason}`);
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

try {
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (pending.length) await capture(pending.shift());
  }));
} finally {
  await browser.close();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
