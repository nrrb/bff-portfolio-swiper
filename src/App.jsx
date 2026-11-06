import React, { useReducer, useSyncExternalStore } from 'react';
import icons from '../icons.svg?no-inline';
import { initialState, reactionReducer, appReactions } from './actions.js';
import { apps, owner } from './data.js';
import { views, currentView, subscribeToNavigation } from './navigation.js';

const actions = [
  { action: 'undo', label: 'Undo', icon: 'undo' },
  { action: 'pass', label: 'Pass', icon: 'pass', large: true },
  { action: 'superlike', label: 'Superlike', icon: 'star' },
  { action: 'like', label: 'Like', icon: 'heart', large: true },
  { action: 'share', label: 'Share', icon: 'share' },
];

function Icon({ name }) {
  return <svg aria-hidden="true"><use href={`${icons}#${name}`} /></svg>;
}

function AppArtwork({ app }) {
  if (app.image) {
    return <div className="app-artwork screenshot-artwork"><img src={app.image} alt={`${app.name} homepage on an iPhone 16 Pro Max display`} /></div>;
  }
  return (
    <div className={`app-artwork ${app.theme}`} aria-label={`${app.name} placeholder preview`}>
      <span className="preview-label">{app.previewLabel}</span>
      <span className="app-monogram">{app.initials}</span>
      <span className="preview-caption">{app.category}</span>
    </div>
  );
}

function AppThumbnail({ app }) {
  return (
    <span className={`app-thumbnail ${app.theme}`} aria-hidden="true">
      {app.image ? <img src={app.image} alt="" loading="lazy" /> : app.initials}
    </span>
  );
}

export function AppList({ items, onSelect }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Icon name="heart-outline" /><h2>You’ve met everyone here</h2>
        <p>Check Chats for matches, or browse the apps for another look.</p>
        <a className="text-link" href="#chats">See your conversations →</a>
      </div>
    );
  }
  return (
    <ul className="app-list">
      {items.map(app => (
        <li key={app.id}>
          <a className="app-row" href="#home" onClick={() => onSelect(app.id)}>
            <AppThumbnail app={app} />
            <span className="row-copy">
              <strong>{app.name}</strong><span>{app.category}{app.year && ` · ${app.year}`}</span>
            </span>
            <span className="row-arrow" aria-hidden="true">›</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ConversationList({ items }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Icon name="chats" /><h2>Your next conversation starts with a like</h2>
        <p>Like or superlike an app and the feeling is mutual.</p>
        <a className="text-link" href="#home">Meet the apps →</a>
      </div>
    );
  }
  return (
    <ul className="app-list conversation-list">
      {items.map(app => (
        <li key={app.id}>
          <a className="app-row conversation-row" href={`#chats/${app.id}`}>
            <AppThumbnail app={app} />
            <span className="row-copy"><strong>{app.name}</strong><span className="conversation-preview">{app.description}</span></span>
            <span className="row-arrow" aria-hidden="true">›</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ConversationThread({ app }) {
  return (
    <>
      <a className="text-link" href="#chats">← All conversations</a>
      <header className="thread-header"><AppThumbnail app={app} /><div><h1>{app.name}</h1><p>It’s a match.</p></div></header>
      <p className="thread-label">Sample conversation</p>
      <div className="messages" aria-label={`Sample conversation with ${app.name}`}>
        <p className="message incoming">{app.description}</p>
        <p className="message outgoing">Okay, you’ve got my attention.</p>
        <p className="message incoming">Good. So, are we making plans or just collecting matches?</p>
      </div>
      <a className="text-link" href="#profile">Talk to the human behind the apps →</a>
    </>
  );
}

export function ContactDetails({ person }) {
  const hasContact = person.email || person.links.length;
  return hasContact ? (
    <ul className="contact-list">
      {person.email && <li><span>Email</span><a href={`mailto:${person.email}`}>{person.email}</a></li>}
      {person.links.map(link => <li key={link.url}><span>{link.label}</span><a href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a></li>)}
    </ul>
  ) : <p className="contact-placeholder">Contact details haven’t been added yet.</p>;
}

export default function App() {
  const route = useSyncExternalStore(subscribeToNavigation, currentView, () => 'home');
  const [view, threadId] = route.split('/');
  const [state, dispatch] = useReducer(reactionReducer, initialState);
  const currentIndex = Math.max(0, apps.findIndex(app => app.id === state.currentAppId));
  const app = apps[currentIndex];
  const reactions = appReactions(state.history);
  const matchedApps = apps.filter(item => ['like', 'superlike'].includes(reactions[item.id]));
  const admirers = apps.filter(item => !reactions[item.id]);
  const conversation = matchedApps.find(item => item.id === threadId);
  const selectApp = appId => dispatch({ type: 'select', appId });

  function handleAction(action) {
    dispatch({ type: action, appId: app.id, name: app.name, nextAppId: action === 'superlike' ? app.id : apps[(currentIndex + 1) % apps.length].id });
  }

  return (
    <main className="phone" aria-label="App portfolio">
      <header className="topbar">
        <a className="wordmark" href="#home" aria-label="BFF home">bff<span>♥</span></a>
        <span className="prototype">MEET YOUR NEXT FAVORITE APP</span>
      </header>
      <div className="view-content" key={view}>
        <section id="view-home" className="swiper-view" aria-label="App swiper" hidden={view !== 'home'}>
          <article className="card" aria-labelledby="app-name">
            <AppArtwork app={app} />
            <div className="profile-copy">
              <span className="likes-you"><Icon name="heart" />{['like', 'superlike'].includes(reactions[app.id]) ? 'It’s a match' : 'Likes You'}</span>
              <h1 id="app-name">{app.name} {app.year && <span className="age">{app.year.slice(-2)}</span>}</h1>
              <p className="app-description">{app.description}</p>
            </div>
          </article>
          <div className="actions" role="group" aria-label="App actions">
            {actions.map(({ action, label, icon, large }) => {
              const href = action === 'superlike' ? app.websiteUrl : action === 'share' ? app.githubUrl : null;
              const className = `action ${action}${large ? ' large' : ''}`;
              if (href) {
                const description = `Opens the project’s ${action === 'superlike' ? 'website' : 'GitHub repository'} in a new tab`;
                return (
                  <a key={action} className={className} href={href} target="_blank" rel="noopener noreferrer"
                    onClick={action === 'superlike' ? () => handleAction(action) : undefined}
                    aria-label={label} aria-description={description} title={description}>
                    <Icon name={icon} />
                  </a>
                );
              }
              return (
                <button key={action} className={className} onClick={() => handleAction(action)}
                  disabled={action === 'superlike' || action === 'share'} aria-label={label}
                  title={action === 'superlike' ? 'No public website available' : label}>
                  <Icon name={icon} />
                </button>
              );
            })}
          </div>
        </section>
        <section id="view-browser" className="page-view" aria-labelledby="browser-title" hidden={view !== 'browser'}>
          <p className="eyebrow">THE COLLECTION</p><h1 id="browser-title">All apps</h1>
          <p className="page-intro">A little browsing. A lot to discover.</p>
          <AppList items={apps} onSelect={selectApp} />
        </section>
        <section id="view-likes" className="page-view" aria-labelledby="likes-title" hidden={view !== 'likes'}>
          <p className="eyebrow">YOU’VE GOT ADMIRERS</p><h1 id="likes-title">Likes You</h1>
          <p className="page-intro">These apps already swiped right on you. Like one back and make it a match.</p>
          <AppList items={admirers} onSelect={selectApp} />
        </section>
        <section id="view-chats" className="page-view" aria-label="Chats" hidden={view !== 'chats'}>
          {conversation ? <ConversationThread app={conversation} /> : (
            <>
              <p className="eyebrow">THE FEELING’S MUTUAL</p><h1>Chats <span className="count">{matchedApps.length}</span></h1>
              <p className="page-intro">You liked them. They’re already into you.</p>
              {threadId && <p className="page-intro">That conversation isn’t available. Match with an app to start chatting.</p>}
              <ConversationList items={matchedApps} />
            </>
          )}
        </section>
        <section id="view-profile" className="page-view" aria-labelledby="owner-name" hidden={view !== 'profile'}>
          <p className="eyebrow">THE PERSON BEHIND THE APPS</p>
          <div className="owner-avatar" aria-hidden="true"><Icon name="profile" /></div>
          <h1 id="owner-name">{owner.name}</h1>
          <p className="page-intro">Thanks for exploring my work. Let’s make something together.</p>
          <h2>Get in touch</h2><ContactDetails person={owner} />
        </section>
      </div>
      <nav className="navigation" aria-label="Main navigation">
        {views.map(item => (
          <a key={item.id} href={`#${item.id}`} className={`nav-button${item.id === view ? ' selected' : ''}`}
            aria-label={item.label} title={item.label} aria-current={item.id === view ? 'page' : undefined}>
            <Icon name={item.icon} />
            {item.id === 'likes' && <span className="badge">99+</span>}
          </a>
        ))}
      </nav>
      <p className="status" role="status">{state.status}</p>
    </main>
  );
}
