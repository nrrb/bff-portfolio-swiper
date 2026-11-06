import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { initialState, reactionReducer, appReactions, shareProfile } from './src/actions.js';
import { apps, owner } from './src/data.js';
import { views, viewFromHash, currentView, subscribeToNavigation } from './src/navigation.js';
import { projectId } from './src/project-id.js';

let server;
let components;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null } });
  components = await server.ssrLoadModule('/src/App.jsx');
});
after(async () => { await server?.close(); });

const react = (state, type, appId, nextAppId) => reactionReducer(state, { type, appId, nextAppId, name: appId });

test('reactions belong to individual apps and undo reopens the affected app', () => {
  const liked = react(initialState, 'like', 'first', 'second');
  let state = react(liked, 'superlike', 'second', 'third');
  assert.equal(state.currentAppId, 'third');
  assert.deepEqual(appReactions(state.history), { first: 'like', second: 'superlike' });
  assert.deepEqual(liked.history, [{ appId: 'first', type: 'like' }]);
  assert.deepEqual(initialState.history, []);
  state = reactionReducer(state, { type: 'undo' });
  assert.equal(state.currentAppId, 'second');
  assert.deepEqual(appReactions(state.history), { first: 'like' });
  state = reactionReducer(state, { type: 'undo' });
  assert.equal(state.currentAppId, 'first');
  assert.deepEqual(state.history, []);
  state = reactionReducer(state, { type: 'undo' });
  assert.equal(state.status, 'Nothing to undo yet');
  assert.equal(state.currentAppId, 'first');
});

test('repeat reactions update one app, pass removes its like, and undo restores it', () => {
  let state = react(initialState, 'like', 'first');
  state = react(state, 'superlike', 'first');
  assert.deepEqual(appReactions(state.history), { first: 'superlike' });
  state = react(state, 'pass', 'first');
  assert.deepEqual(appReactions(state.history), { first: 'pass' });
  state = reactionReducer(state, { type: 'undo' });
  assert.deepEqual(appReactions(state.history), { first: 'superlike' });
});

test('opening an app or updating share status preserves likes', () => {
  const state = react(initialState, 'like', 'first');
  const opened = reactionReducer(state, { type: 'select', appId: 'second' });
  const updated = reactionReducer(opened, { type: 'status', message: 'Share canceled' });
  assert.deepEqual(appReactions(updated.history), { first: 'like' });
  assert.equal(updated.currentAppId, 'second');
  assert.equal(updated.status, 'Share canceled');
});

test('navigation resolves all five links and falls back to Home', () => {
  for (const view of views) assert.equal(viewFromHash(`#${view.id}`), view.id);
  assert.equal(viewFromHash(''), 'home');
  assert.equal(viewFromHash('#unknown'), 'home');
});

test('navigation subscribes to browser history changes and cleans up', () => {
  const previousWindow = globalThis.window;
  const browser = new EventTarget();
  browser.location = { hash: '#browser' };
  globalThis.window = browser;
  try {
    let changes = 0;
    const unsubscribe = subscribeToNavigation(() => { changes++; });
    assert.equal(currentView(), 'browser');
    browser.location.hash = '#likes';
    browser.dispatchEvent(new Event('hashchange'));
    assert.equal(currentView(), 'likes');
    assert.equal(changes, 1);
    unsubscribe();
    browser.dispatchEvent(new Event('hashchange'));
    assert.equal(changes, 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

const shareData = { title: 'BFF', url: 'http://localhost:5173/#home' };
test('share uses the native share sheet or clipboard fallback', async () => {
  let received;
  assert.equal(await shareProfile(shareData, { share: async data => { received = data; } }), 'Share dialog completed');
  assert.deepEqual(received, shareData);
  let copied;
  const message = await shareProfile(shareData, { clipboard: { writeText: async text => { copied = text; } } });
  assert.equal(copied, shareData.url);
  assert.match(message, /copied/);
});

test('share handles native cancellation, clipboard errors, and missing APIs', async () => {
  const canceled = await shareProfile(shareData, { share: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } });
  assert.equal(canceled, 'Share canceled');
  const denied = await shareProfile(shareData, { clipboard: { writeText: async () => { throw new Error('denied'); } } });
  assert.match(denied, /Could not share/);
  assert.match(await shareProfile(shareData, {}), /Could not share/);
});

test('React renders five views, the five action controls, and correct navigation links', async () => {
  const html = renderToStaticMarkup(React.createElement(components.default));
  const svg = await readFile(new URL('./icons.svg', import.meta.url), 'utf8');
  const references = [...html.matchAll(/<use href="([^"]+)"/g)];
  assert.ok(references.length >= 10);
  for (const [, href] of references) {
    const id = href.split('#')[1];
    assert.ok(id && svg.includes(`id="${id}"`), href);
  }
  for (const label of ['Undo', 'Pass', 'Superlike', 'Like', 'Share']) assert.ok(html.includes(`aria-label="${label}"`));
  for (const view of views) assert.match(html, new RegExp(`href="#${view.id}"[^>]*aria-label="${view.label}"`));
  const sections = [...html.matchAll(/<section[^>]*>/g)].map(match => match[0]);
  assert.equal(sections.length, 5);
  assert.equal(sections.filter(section => !section.includes('hidden')).length, 1);
  assert.ok(sections.find(section => section.includes('view-home') && !section.includes('hidden')));
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /<dialog|99\+/);
  assert.match(html, /Nicholas Bennett/);
  assert.equal([...html.matchAll(/mailto:nicholasbennett.work@gmail.com/g)].length, 2);
});

test('saved list includes likes and superlikes once and excludes passed apps', () => {
  let state = react(initialState, 'like', apps[0].id);
  state = react(state, 'superlike', apps[1].id);
  state = react(state, 'pass', apps[2].id);
  state = react(state, 'superlike', apps[0].id);
  const reactions = appReactions(state.history);
  const items = apps.filter(app => ['like', 'superlike'].includes(reactions[app.id]));
  const html = renderToStaticMarkup(React.createElement(components.AppList, { items, reactions, onSelect() {} }));
  assert.equal([...html.matchAll(/class="app-row"/g)].length, 2);
  assert.ok(html.includes(apps[0].name.replaceAll('&', '&amp;')));
  assert.ok(html.includes(apps[1].name));
  assert.ok(!html.includes(apps[2].name));
  assert.match(html, /Superliked/);
  const empty = renderToStaticMarkup(React.createElement(components.AppList, { items: [], reactions: {}, onSelect() {} }));
  assert.match(empty, /No likes yet/);
  assert.match(empty, /href="#home"/);
});

test('contact details render working links and an honest empty state', () => {
  const html = renderToStaticMarkup(React.createElement(components.ContactDetails, { person: owner }));
  assert.match(html, /href="mailto:nicholasbennett.work@gmail.com"/);
  for (const link of owner.links) assert.ok(html.includes(`href="${link.url}"`));
  const empty = renderToStaticMarkup(React.createElement(components.ContactDetails, { person: { email: '', links: [] } }));
  assert.match(empty, /haven’t been added/);
  assert.doesNotMatch(empty, /href=/);
});

test('all supplied projects have stable IDs and verified screenshot files or an explicit fallback', async () => {
  const source = JSON.parse(await readFile(new URL('./projects.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('./src/screenshots.json', import.meta.url), 'utf8'));
  assert.equal(apps.length, source.length);
  assert.equal(new Set(apps.map(app => app.id)).size, apps.length);
  for (const project of source) {
    const id = projectId(project);
    const app = apps.find(item => item.id === id);
    assert.equal(app.description, project.description);
    assert.match(project.firstCommitDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, `${project.name} needs a creation date`);
    assert.ok(Number.isFinite(Date.parse(project.firstCommitDate)), project.name);
    assert.equal(app.year, project.firstCommitDate.slice(0, 4));
    const capture = manifest[id];
    assert.ok(capture, id);
    if (capture.status === 'captured') {
      assert.deepEqual([capture.width, capture.height], [1320, 2868]);
      const image = await readFile(new URL(`./public/${capture.file}`, import.meta.url));
      assert.ok(image.length > 1000, id);
      assert.equal(app.image, `/${capture.file}`);
    } else {
      assert.ok(['failed', 'unavailable'].includes(capture.status));
      assert.ok(capture.reason);
      assert.equal(app.image, null);
    }
  }
});
