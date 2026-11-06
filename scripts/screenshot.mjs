import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { projectId } from '../src/project-id.js';

const contentPath = new URL('../content.json', import.meta.url);
const content = JSON.parse(await readFile(contentPath, 'utf8'));
const { projects } = content;
const output = new URL('../public/project-screenshots/', import.meta.url);
await mkdir(output, { recursive: true });
const device = devices['iPhone 16 Pro Max'];
assert.deepEqual(device.screen, { width: 440, height: 956 });
const browser = await chromium.launch({ channel: 'chromium' });
const selected = new Set(process.argv.slice(2));
const pending = projects.filter(project => !selected.size || selected.has(projectId(project)));
const updated = new Map();

async function capture(project) {
  const id = projectId(project);
  if (!project.websiteUrl) {
    project.image = null;
    project.capture = { status: 'unavailable', reason: 'No public website URL' };
    updated.set(id, project);
    console.log(`${id}: no public website`);
    return;
  }
  const context = await browser.newContext({ ...device, viewport: device.screen, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    const response = await page.goto(project.websiteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? 'no response'}`);
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    if (project.screenshotDismissButton) {
      const onboarding = page.getByRole('button', { name: project.screenshotDismissButton, exact: true });
      if (await onboarding.isVisible()) await onboarding.click();
    }
    await page.waitForTimeout(1500);
    assert.deepEqual(page.viewportSize(), device.screen);
    assert.equal(await page.evaluate(() => devicePixelRatio), 3);
    await page.screenshot({ path: new URL(`${id}.jpg`, output).pathname, type: 'jpeg', quality: 85, fullPage: false, scale: 'device', timeout: 15000 });
    project.image = `/project-screenshots/${id}.jpg`;
    project.capture = { status: 'captured', sourceUrl: project.websiteUrl, capturedUrl: page.url(), viewport: device.screen, width: 1320, height: 2868 };
    console.log(`${id}: captured 1320×2868`);
  } catch (error) {
    project.image = null;
    project.capture = { status: 'failed', sourceUrl: project.websiteUrl, reason: error.message.split('\n')[0] };
    console.error(`${id}: ${project.capture.reason}`);
    process.exitCode = 1;
  } finally {
    updated.set(id, project);
    await context.close();
  }
}

try {
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (pending.length) await capture(pending.shift());
  }));
} finally {
  await browser.close();
  // Preserve content edits made while screenshots were being captured.
  const latest = JSON.parse(await readFile(contentPath, 'utf8'));
  for (const project of latest.projects) {
    const result = updated.get(projectId(project));
    if (result && result.websiteUrl === project.websiteUrl) {
      project.image = result.image;
      project.capture = result.capture;
    }
  }
  const temporaryPath = new URL('../content.json.tmp', import.meta.url);
  await writeFile(temporaryPath, `${JSON.stringify(latest, null, 2)}\n`);
  await rename(temporaryPath, contentPath);
}
