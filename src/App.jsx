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

export function AppList({ items, reactions, onSelect }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Icon name="heart-outline" /><h2>No likes yet</h2>
        <p>Like or superlike an app on Home and it will appear here.</p>
        <a className="text-link" href="#home">Find your next favorite app →</a>
      </div>
    );
  }
  return (
    <ul className="app-list">
      {items.map(app => (
        <li key={app.id}>
          <a className="app-row" href="#home" onClick={() => onSelect(app.id)}>
            <span className={`app-thumbnail ${app.theme}`} aria-hidden="true">
              {app.image ? <img src={app.image} alt="" loading="lazy" /> : app.initials}
            </span>
            <span className="row-copy">
              <strong>{app.name}</strong><span>{app.category}{app.year && ` · ${app.year}`}</span>
              {['like', 'superlike'].includes(reactions[app.id]) && (
                <span className={`saved-reaction ${reactions[app.id]}`}>
                  <Icon name={reactions[app.id] === 'superlike' ? 'star' : 'heart'} />
                  {reactions[app.id] === 'superlike' ? 'Superliked' : 'Liked'}
                </span>
              )}
            </span>
            <span className="row-arrow" aria-hidden="true">›</span>
          </a>
        </li>
      ))}
    </ul>
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
  const view = useSyncExternalStore(subscribeToNavigation, currentView, () => 'home');
  const [state, dispatch] = useReducer(reactionReducer, initialState);
  const currentIndex = Math.max(0, apps.findIndex(app => app.id === state.currentAppId));
  const app = apps[currentIndex];
  const reactions = appReactions(state.history);
  const likedApps = apps.filter(item => ['like', 'superlike'].includes(reactions[item.id]));
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
              <span className="likes-you"><Icon name="compass" />{app.category}</span>
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
          <AppList items={apps} reactions={reactions} onSelect={selectApp} />
        </section>
        <section id="view-likes" className="page-view" aria-labelledby="likes-title" hidden={view !== 'likes'}>
          <p className="eyebrow">GOOD TASTE</p><h1 id="likes-title">Your likes <span className="count">{likedApps.length}</span></h1>
          <p className="page-intro">All the apps you liked or superliked.</p>
          <AppList items={likedApps} reactions={reactions} onSelect={selectApp} />
        </section>
        <section id="view-contact" className="page-view" aria-labelledby="contact-title" hidden={view !== 'contact'}>
          <p className="eyebrow">SAY HELLO</p><h1 id="contact-title">Let’s talk</h1>
          <p className="page-intro">Have a question or a project in mind? Here’s how to reach me.</p>
          <ContactDetails person={owner} />
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
            {item.id === 'likes' && likedApps.length > 0 && <span className="badge">{likedApps.length}</span>}
          </a>
        ))}
      </nav>
      <p className="status" role="status">{state.status}</p>
    </main>
  );
}
