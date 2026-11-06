import React, { useReducer, useState, useSyncExternalStore } from 'react';
import Icon from './Icon.jsx';
import Swiper from './Swiper.jsx';
import AuthorCard from './AuthorCard.jsx';
import { createInitialState, reactionReducer, appReactions } from './actions.js';
import { apps, owner } from './data.js';
import { views, currentView, subscribeToNavigation } from './navigation.js';

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
      {person.email && <li><a href={`mailto:${person.email}`}>{person.email}</a></li>}
      {person.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a></li>)}
    </ul>
  ) : <p className="contact-placeholder">Contact details haven’t been added yet.</p>;
}

export default function App() {
  const route = useSyncExternalStore(subscribeToNavigation, currentView, () => 'home');
  const [view, threadId] = route.split('/');
  const [state, dispatch] = useReducer(reactionReducer, apps.map(app => app.id), createInitialState);
  const [match, setMatch] = useState(null);
  const app = apps.find(app => app.id === state.currentAppId);
  const nextAppId = state.queue.find(id => id !== state.currentAppId);
  const nextApp = apps.find(app => app.id === nextAppId);
  const reactions = appReactions(state.history);
  const matchedApps = apps.filter(item => ['like', 'superlike'].includes(reactions[item.id]));
  const admirers = apps.filter(item => !reactions[item.id]);
  const conversation = matchedApps.find(item => item.id === threadId);
  const selectApp = appId => dispatch({ type: 'select', appId });

  function handleAction(action) {
    setMatch(['like', 'superlike'].includes(action) ? { name: app.name, key: state.history.length } : null);
    dispatch({ type: action, appId: app.id, name: app.name });
  }

  function handleUndo() {
    setMatch(null);
    dispatch({ type: 'undo' });
  }

  return (
    <main className="phone" aria-label="App portfolio">
      <header className="topbar">
        <a className="wordmark" href="#home" aria-label="BFF home">bff<span>♥</span></a>
        <span className="prototype">MEET YOUR NEXT FAVORITE APP</span>
      </header>
      <div className="view-content" key={view}>
        <section id="view-home" className="swiper-view" aria-label="App swiper" hidden={view !== 'home'}>
          <Swiper app={app} nextApp={nextApp} matched={['like', 'superlike'].includes(reactions[app?.id])}
            onReact={handleAction} onUndo={handleUndo} canUndo={state.history.length > 0} />
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
        <section id="view-profile" className="page-view author-profile" aria-labelledby="owner-name" hidden={view !== 'profile'}>
          <AuthorCard name={owner.name}>
            <span className="likes-you"><Icon name="heart" />THE AUTHOR</span>
            <h1 id="owner-name">{owner.name}</h1>
            <div className="app-description"><ContactDetails person={owner} /></div>
          </AuthorCard>
        </section>
      </div>
      <nav className="navigation" aria-label="Main navigation">
        {views.map(item => (
          <a key={item.id} href={`#${item.id}`} className={`nav-button${item.id === view ? ' selected' : ''}`}
            aria-label={item.label} title={item.label} aria-current={item.id === view ? 'page' : undefined}>
            <Icon name={item.icon} />
            {item.id === 'likes' && <span className="badge">{admirers.length}</span>}
            {item.id === 'chats' && matchedApps.length > 0 && <span className="chat-dot" aria-hidden="true" />}
          </a>
        ))}
      </nav>
      <span className="sr-only" role="status">{state.status}</span>
      {match && (
        <div className="match-celebration" aria-hidden="true">
          <div key={match.key} className="match-popup" onAnimationEnd={event => {
            if (event.animationName === 'match-pop-out') setMatch(null);
          }}>
            <Icon name="heart" /><strong>You matched!</strong><span>{match.name}</span>
          </div>
        </div>
      )}
    </main>
  );
}
