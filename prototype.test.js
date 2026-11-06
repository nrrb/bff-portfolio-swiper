import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createInitialState, reactionReducer, appReactions } from './src/actions.js';
import { apps, owner, site, copy } from './src/data.js';
import { views, viewFromHash, currentView, subscribeToNavigation } from './src/navigation.js';
import { projectId } from './src/project-id.js';

let server;
let components;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  components = await server.ssrLoadModule('/src/App.jsx');
});
after(async () => { await server?.close(); });

const initialState = createInitialState(apps.map(app => app.id));
const react = (state, type, appId) => reactionReducer(state, { type, appId, name: appId });

test('HTML metadata comes from the content file before client JavaScript runs', async () => {
  const template = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const html = await server.transformIndexHtml('/', template);
  assert.ok(html.includes(`<title>${site.title}</title>`));
  assert.ok(html.includes(`<meta property="og:title" content="${site.title}">`));
  assert.ok(html.includes(`<meta name="description" content="${site.description}">`));
  assert.ok(html.includes(`<link rel="canonical" href="${site.url}">`));
  assert.ok(html.includes(`<meta property="og:image" content="${site.image}">`));
  assert.ok(html.includes(`<meta property="og:image:alt" content="${site.imageAlt}">`));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.doesNotMatch(html, /%CONTENT_/);
  await assert.rejects(server.transformIndexHtml('/', '%CONTENT_missingKey%'), /Missing site content/);
});

test('passing moves an app to the bottom until every other queued app has appeared', () => {
  const initial = createInitialState(['first', 'second', 'third']);
  let state = react(initial, 'pass', 'first');
  assert.deepEqual(state.queue, ['second', 'third', 'first']);
  assert.equal(state.currentAppId, 'second');
  state = react(state, 'pass', 'second');
  assert.equal(state.currentAppId, 'third');
  state = react(state, 'pass', 'third');
  assert.equal(state.currentAppId, 'first');
  assert.deepEqual(state.queue, ['first', 'second', 'third']);
  assert.deepEqual(initial.queue, ['first', 'second', 'third']);
  assert.deepEqual(initial.history, []);
});

test('likes and superlikes leave the deck, create matches, and allow an empty deck', () => {
  let state = createInitialState(['first', 'second']);
  state = react(state, 'like', 'first');
  assert.deepEqual(state.queue, ['second']);
  assert.equal(state.currentAppId, 'second');
  state = react(state, 'superlike', 'second');
  assert.deepEqual(state.queue, []);
  assert.equal(state.currentAppId, null);
  assert.deepEqual(appReactions(state.history), { first: 'like', second: 'superlike' });
  assert.equal(state.status, `${copy.status.matched} · second`);
  state = reactionReducer(state, { type: 'undo' });
  assert.deepEqual(state.queue, ['second']);
  assert.equal(state.currentAppId, 'second');
});

test('undo restores the exact deck order and previous match state', () => {
  const initial = createInitialState(['first', 'second', 'third']);
  const passed = react(initial, 'pass', 'first');
  let state = react(passed, 'like', 'second');
  state = reactionReducer(state, { type: 'undo' });
  assert.deepEqual(state.queue, passed.queue);
  assert.equal(state.currentAppId, 'second');
  assert.deepEqual(appReactions(state.history), { first: 'pass' });
  assert.equal(state.status, copy.status.undid.like);
  state = reactionReducer(state, { type: 'undo' });
  assert.deepEqual(state.queue, initial.queue);
  assert.equal(state.currentAppId, 'first');
  assert.deepEqual(appReactions(state.history), {});
  assert.deepEqual(passed.queue, ['second', 'third', 'first']);
  state = reactionReducer(state, { type: 'undo' });
  assert.equal(state.status, copy.status.nothingToUndo);
  assert.deepEqual(state.queue, initial.queue);
});

test('Browser can preview a matched app without returning it to the swipe queue', () => {
  const liked = react(createInitialState(['first', 'second', 'third']), 'like', 'first');
  const preview = reactionReducer(liked, { type: 'select', appId: 'first' });
  assert.equal(preview.currentAppId, 'first');
  assert.deepEqual(preview.queue, ['second', 'third']);
  const superliked = react(preview, 'superlike', 'first');
  assert.deepEqual(superliked.queue, ['second', 'third']);
  assert.deepEqual(appReactions(superliked.history), { first: 'superlike' });
  const undone = reactionReducer(superliked, { type: 'undo' });
  assert.deepEqual(appReactions(undone.history), { first: 'like' });
  const passed = react(preview, 'pass', 'first');
  assert.deepEqual(passed.queue, ['second', 'third', 'first']);
  assert.deepEqual(appReactions(passed.history), { first: 'pass' });
});

test('selecting an unmatched app brings it forward and a one-card deck safely cycles', () => {
  const selected = reactionReducer(createInitialState(['first', 'second', 'third']), { type: 'select', appId: 'third' });
  assert.deepEqual(selected.queue, ['third', 'first', 'second']);
  const passed = react(createInitialState(['only']), 'pass', 'only');
  assert.deepEqual(passed.queue, ['only']);
  assert.equal(passed.currentAppId, 'only');
  assert.deepEqual(createInitialState([]).queue, []);
  assert.equal(createInitialState([]).currentAppId, null);
});

test('navigation resolves all five links and falls back to Home', () => {
  for (const view of views) assert.equal(viewFromHash(`#${view.id}`), view.id);
  assert.equal(viewFromHash(''), 'home');
  assert.equal(viewFromHash('#unknown'), 'home');
  for (const app of apps) assert.equal(viewFromHash(`#chats/${app.id}`), `chats/${app.id}`);
  assert.equal(viewFromHash('#browser/anything'), 'home');
  assert.equal(viewFromHash('#chats/app/extra'), 'home');
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

test('React renders five views, the five action controls, and correct navigation links', async () => {
  const html = renderToStaticMarkup(React.createElement(components.default));
  const svg = await readFile(new URL('./icons.svg', import.meta.url), 'utf8');
  const references = [...html.matchAll(/<use href="([^"]+)"/g)];
  assert.ok(references.length >= 10);
  for (const [, href] of references) {
    const id = href.split('#')[1];
    assert.ok(id && svg.includes(`id="${id}"`), href);
  }
  for (const label of ['undo', 'pass', 'superlike', 'like', 'share'].map(action => copy.actions[action])) assert.ok(html.includes(`aria-label="${label}"`));
  for (const view of views) assert.match(html, new RegExp(`href="#${view.id}"[^>]*aria-label="${view.label}"`));
  const sections = [...html.matchAll(/<section[^>]*>/g)].map(match => match[0]);
  assert.equal(sections.length, 5);
  assert.equal(sections.filter(section => !section.includes('hidden')).length, 1);
  assert.ok(sections.find(section => section.includes('view-home') && !section.includes('hidden')));
  const home = html.match(/<section id="view-home"[\s\S]*?<\/section>/)[0];
  const profileCopy = home.match(/<div class="profile-copy">[\s\S]*?<\/div>/)[0];
  assert.doesNotMatch(profileCopy, /<a\b/, 'App text should not contain Visit project or Source links');
  const externalControls = [...home.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);
  assert.equal(externalControls.length, 2);
  for (const control of externalControls) {
    assert.match(control, /target="_blank"/);
    assert.match(control, /rel="noopener noreferrer"/);
  }
  assert.ok(externalControls.find(control => control.includes(`aria-label="${copy.actions.superlike}"`) && control.includes(`href="${apps[0].websiteUrl}"`)));
  assert.ok(externalControls.find(control => control.includes(`aria-label="${copy.actions.share}"`) && control.includes(`href="${apps[0].githubUrl}"`)));
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /<dialog|id="view-contact"/);
  assert.doesNotMatch(html, /<p class="status"/);
  assert.ok(html.includes('<span class="sr-only" role="status">'));
  assert.ok(html.includes(`<span class="badge">${apps.length}</span>`));
  assert.doesNotMatch(html, /class="page-intro"/);
  assert.ok(html.includes(owner.name.replaceAll('&', '&amp;')));
  assert.equal(html.split(`mailto:${owner.email}`).length - 1, 1);
});

test('matches become conversations and decided apps leave Likes You', () => {
  let state = react(initialState, 'like', apps[0].id);
  state = react(state, 'superlike', apps[1].id);
  state = react(state, 'pass', apps[2].id);
  state = react(state, 'superlike', apps[0].id);
  const reactions = appReactions(state.history);
  const items = apps.filter(app => ['like', 'superlike'].includes(reactions[app.id]));
  const html = renderToStaticMarkup(React.createElement(components.ConversationList, { items }));
  assert.equal([...html.matchAll(/class="app-row conversation-row"/g)].length, 2);
  assert.ok(html.includes(apps[0].name.replaceAll('&', '&amp;')));
  assert.ok(html.includes(apps[1].name));
  assert.ok(!html.includes(apps[2].name));
  assert.ok(html.includes(`href="#chats/${apps[0].id}"`));
  assert.ok(html.includes(`href="#chats/${apps[1].id}"`));
  const admirers = apps.filter(app => !reactions[app.id]);
  const likes = renderToStaticMarkup(React.createElement(components.AppList, { items: admirers, onSelect() {} }));
  assert.equal([...likes.matchAll(/class="app-row"/g)].length, apps.length - 3);
  for (const app of apps.slice(0, 3)) assert.ok(!likes.includes(`>${app.name.replaceAll('&', '&amp;')}<`));
  const empty = renderToStaticMarkup(React.createElement(components.ConversationList, { items: [] }));
  assert.ok(empty.includes(copy.emptyChats.title));
  assert.match(empty, /href="#home"/);
  const noAdmirers = renderToStaticMarkup(React.createElement(components.AppList, { items: [], onSelect() {} }));
  assert.ok(noAdmirers.includes(copy.emptyList.body));
  assert.match(noAdmirers, /href="#chats"/);
});

test('sample threads belong to their matched app and keep contact information on Profile', () => {
  const html = renderToStaticMarkup(React.createElement(components.ConversationThread, { app: apps[0] }));
  assert.ok(html.includes(copy.conversation.label));
  assert.ok(html.includes(apps[0].description.replaceAll('&', '&amp;')));
  assert.equal([...html.matchAll(/class="message /g)].length, 3);
  assert.match(html, /href="#chats"/);
  assert.match(html, /href="#profile"/);
  assert.ok(!html.includes(owner.email));
  for (const link of owner.links) assert.ok(!html.includes(link.url));
});

test('contact details render working links and an honest empty state', () => {
  const html = renderToStaticMarkup(React.createElement(components.ContactDetails, { person: owner }));
  assert.ok(html.includes(`href="mailto:${owner.email}"`));
  for (const link of owner.links) assert.ok(html.includes(`href="${link.url}"`));
  const empty = renderToStaticMarkup(React.createElement(components.ContactDetails, { person: { email: '', links: [] } }));
  assert.ok(empty.includes(copy.contactPlaceholder));
  assert.doesNotMatch(empty, /href=/);
});

test('personal profile uses the configured photo, author pill, and contact links', async () => {
  const html = renderToStaticMarkup(React.createElement(components.default));
  const profile = html.match(/<section id="view-profile"[\s\S]*?<\/section>/)[0];
  assert.match(profile, /class="author-card card"/);
  assert.match(profile, /class="profile-copy author-copy"/);
  assert.ok(profile.includes(`${copy.authorLabel}</span>`));
  assert.doesNotMatch(profile, /carousel|photo-arrow|photo-counter|swipe-deck|front-card|aria-label="Like"|aria-label="Pass"/);
  const bio = profile.match(/<div class="app-description">[\s\S]*?<\/div>/)[0];
  assert.ok(bio.includes(`mailto:${owner.email}`));
  for (const { url } of owner.links) assert.ok(bio.includes(`href="${url}"`));
  assert.equal([...profile.matchAll(/<img\b/g)].length, 1);
  assert.ok(profile.includes(`src="${owner.photo.src}"`));
  assert.ok(profile.includes(`alt="${owner.photo.alt}"`));
  assert.ok(profile.includes(`width="${owner.photo.width}" height="${owner.photo.height}"`));
  if (owner.photo.src.startsWith('/')) {
    const image = await readFile(new URL(`./public${owner.photo.src}`, import.meta.url));
    assert.ok(image.length > 0);
  }
});

test('all supplied projects have stable IDs and verified screenshot files or an explicit fallback', async () => {
  const { projects: source } = JSON.parse(await readFile(new URL('./content.json', import.meta.url), 'utf8'));
  assert.equal(apps.length, source.length);
  assert.equal(new Set(apps.map(app => app.id)).size, apps.length);
  for (const project of source) {
    const id = projectId(project);
    const app = apps.find(item => item.id === id);
    assert.equal(app.description, project.description);
    if (project.firstCommitDate) {
      assert.ok(Number.isFinite(Date.parse(project.firstCommitDate)), project.name);
      assert.equal(app.year, project.firstCommitDate.slice(0, 4));
    } else {
      assert.equal(app.year, null);
    }
    assert.equal(app.image, project.image);
    if (project.image?.startsWith('/')) {
      const image = await readFile(new URL(`./public${project.image}`, import.meta.url));
      assert.ok(image.length > 0, id);
    }
    if (project.capture?.status === 'captured') {
      assert.deepEqual([project.capture.width, project.capture.height], [1320, 2868]);
    }
  }
});

test('a different owner and sparse dataset render using only content changes', async () => {
  const content = JSON.parse(await readFile(new URL('./content.json', import.meta.url), 'utf8'));
  content.site.wordmark = 'new brand';
  content.site.tagline = 'Explore my collection';
  content.owner = {
    name: 'Alex Example', email: 'alex@example.com', links: [],
    photo: { src: '/custom-avatar.jpg', alt: 'Alex at work', width: 800, height: 900 },
  };
  content.copy.authorLabel = 'THE CREATOR';
  content.projects = [{ slug: 'custom-item', name: 'Custom item', description: 'My own dataset.', image: 'https://example.com/preview.jpg' }];
  const custom = await createServer({
    plugins: [{
      name: 'custom-content-fixture', enforce: 'pre',
      load(id) {
        if (id === new URL('./content.json', import.meta.url).pathname) return JSON.stringify(content);
      },
    }],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  try {
    const { default: App } = await custom.ssrLoadModule('/src/App.jsx');
    const { apps: customApps } = await custom.ssrLoadModule('/src/data.js');
    const html = renderToStaticMarkup(React.createElement(App));
    for (const value of ['new brand', 'Explore my collection', 'Alex Example', 'alex@example.com',
      '/custom-avatar.jpg', 'Alex at work', 'THE CREATOR', 'Custom item', 'My own dataset.', 'https://example.com/preview.jpg']) {
      assert.ok(html.includes(value), value);
    }
    assert.ok(!html.includes(owner.name));
    assert.ok(!html.includes(owner.photo.src));
    assert.equal(customApps.length, 1);
    assert.equal(customApps[0].id, 'custom-item');
    assert.equal(customApps[0].year, null);
    content.projects = [];
    custom.moduleGraph.invalidateAll();
    const { default: EmptyApp } = await custom.ssrLoadModule('/src/App.jsx');
    assert.ok(renderToStaticMarkup(React.createElement(EmptyApp)).includes(copy.emptyDeck.title));
  } finally {
    await custom.close();
  }
});
