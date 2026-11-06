import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { parseTour } from '../tools/tours/lexicon.js';
import { playTour } from '../tools/tours/playback.js';

let context, browser, page;
try {
  const [file, option, address] = process.argv.slice(2);
  if (!file || ![1, 3].includes(process.argv.slice(2).length) || (option && (option !== '--url' || !address))) throw new Error('Usage: npm run demo -- <tour.txt> [--url http://127.0.0.1:5173/]');
  const url = new URL(address || 'http://127.0.0.1:5173/');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('App URL must use HTTP(S)');
  const steps = parseTour(await readFile(file, 'utf8'));
  if (steps[0].id !== 'open') throw new Error(`Line ${steps[0].line}: Start the tour with Open app`);
  const output = resolve('recordings');
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: 'chromium' });
  context = await browser.newContext({ viewport: { width: 440, height: 956 }, recordVideo: { dir: output, size: { width: 440, height: 956 } }, reducedMotion: 'no-preference' });
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  await playTour(page, steps, url.href);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    const video = page?.video();
    await context?.close();
    if (video) console.log(`Recording${process.exitCode ? ' (partial)' : ''}: ${await video.path()}`);
  } finally { await browser?.close(); }
}
