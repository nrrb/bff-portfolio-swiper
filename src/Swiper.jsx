import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const actions = [
  { action: 'undo', label: 'Undo', icon: 'undo' },
  { action: 'pass', label: 'Pass', icon: 'pass', large: true },
  { action: 'superlike', label: 'Superlike', icon: 'star' },
  { action: 'like', label: 'Like', icon: 'heart', large: true },
  { action: 'share', label: 'Share', icon: 'share' },
];

const resting = { x: 0, y: 0, phase: 'idle', outgoing: null, cycle: 0 };

function CardContent({ app, front, matched }) {
  return (
    <>
      {app.image ? (
        <div className="app-artwork screenshot-artwork"><img src={app.image} alt={`${app.name} homepage on an iPhone 16 Pro Max display`} draggable={false} /></div>
      ) : (
        <div className={`app-artwork ${app.theme}`} aria-label={`${app.name} placeholder preview`}>
          <span className="preview-label">{app.previewLabel}</span><span className="app-monogram">{app.initials}</span><span className="preview-caption">{app.category}</span>
        </div>
      )}
      <div className="profile-copy">
        <span className="likes-you"><Icon name="heart" />{matched ? 'It’s a match' : 'Likes You'}</span>
        <h1 id={front ? 'app-name' : undefined}>{app.name} {app.year && <span className="age">’{app.year.slice(-2)}</span>}</h1>
        <p className="app-description">{app.description}</p>
      </div>
    </>
  );
}

export default function Swiper({ app, nextApp, matched, onReact, onUndo, canUndo }) {
  const [motion, setMotion] = useState(resting);
  const pointer = useRef(null);
  const stack = useRef(null);
  const exitTimer = useRef(null);
  const busy = motion.phase === 'exit';
  const shown = motion.outgoing?.app || app;
  const underneath = motion.outgoing ? app : nextApp;

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  function finishExit() {
    clearTimeout(exitTimer.current);
    setMotion(current => current.phase === 'exit' ? { ...resting, cycle: current.cycle + 1 } : current);
  }

  function decide(type) {
    if (!app || busy) return;
    pointer.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Keep the clicked link intact until the browser starts its new-tab navigation.
      setMotion(current => ({ ...current, outgoing: { app, matched }, phase: 'exit' }));
      exitTimer.current = setTimeout(finishExit, 0);
    } else {
      const direction = type === 'pass' ? -1 : 1;
      setMotion(current => ({ ...current, outgoing: { app, matched }, phase: 'exit', x: direction * (window.innerWidth + stack.current.clientWidth) }));
      exitTimer.current = setTimeout(finishExit, 350);
    }
    onReact(type);
  }

  function startDrag(event) {
    if (!app || busy || !event.isPrimary || event.button !== 0) return;
    pointer.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: 0, y: 0, locked: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    const drag = pointer.current;
    if (!drag || drag.id !== event.pointerId) return;
    const x = event.clientX - drag.startX;
    const y = event.clientY - drag.startY;
    if (!drag.locked) {
      if (Math.max(Math.abs(x), Math.abs(y)) < 8) return;
      if (Math.abs(y) > Math.abs(x)) {
        cancelDrag(event);
        return;
      }
      drag.locked = true;
    }
    drag.x = x;
    drag.y = y;
    setMotion(current => ({ ...current, x, y: y * .2, phase: 'dragging' }));
  }

  function cancelDrag(event) {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setMotion(current => ({ ...current, x: 0, y: 0, phase: 'idle' }));
  }

  function endDrag(event) {
    const drag = pointer.current;
    if (!drag || drag.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const threshold = Math.min(120, event.currentTarget.clientWidth * .27);
    if (drag.locked && Math.abs(drag.x) >= threshold) decide(drag.x > 0 ? 'like' : 'pass');
    else setMotion(current => ({ ...current, x: 0, y: 0, phase: 'idle' }));
  }

  return (
    <div className="swipe-deck" data-phase={motion.phase}>
      <div className="card-stack" ref={stack} onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={endDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
        onDragStart={event => event.preventDefault()}>
        {underneath && <article className="card under-card" aria-hidden="true" inert><CardContent app={underneath} /></article>}
        {shown ? (
          <article key={motion.cycle} className="card front-card" data-front="" data-app-id={shown.id} aria-labelledby="app-name"
            style={{ transform: `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${Math.max(-22, Math.min(22, motion.x / 18))}deg)` }}
            onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'transform' && busy) finishExit(); }}>
            <CardContent app={shown} front matched={motion.outgoing?.matched ?? matched} />
            <span className={`swipe-stamp ${motion.x > 0 ? 'stamp-like' : 'stamp-pass'}`} aria-hidden="true"
              style={{ opacity: Math.min(Math.abs(motion.x) / 90, 1) }}>{motion.x > 0 ? 'LIKE' : 'NOPE'}</span>
          </article>
        ) : (
          <div className="deck-empty empty-state"><Icon name="heart" /><h2>You’ve met your matches</h2>
            <p>Your conversations are waiting in Chats.</p><a className="text-link" href="#chats">Go say hello →</a></div>
        )}
      </div>
      <div className="actions" role="group" aria-label="App actions">
        {actions.map(({ action, label, icon, large }) => {
          const href = action === 'superlike' ? shown?.websiteUrl : action === 'share' ? shown?.githubUrl : null;
          const className = `action ${action}${large ? ' large' : ''}`;
          if (href) {
            const description = `Opens the project’s ${action === 'superlike' ? 'website' : 'GitHub repository'} in a new tab`;
            return <a key={action} className={className} href={href} target="_blank" rel="noopener noreferrer"
              aria-label={label} aria-description={description} title={description} aria-disabled={busy || undefined} tabIndex={busy ? -1 : undefined}
              onClick={event => { if (busy) event.preventDefault(); else if (action === 'superlike') decide(action); }}><Icon name={icon} /></a>;
          }
          return <button key={action} className={className} aria-label={label}
            title={action === 'superlike' ? 'No public website available' : label}
            disabled={busy || (action === 'undo' ? !canUndo : !shown || action === 'superlike' || action === 'share')}
            onClick={() => action === 'undo' ? onUndo() : decide(action)}><Icon name={icon} /></button>;
        })}
      </div>
    </div>
  );
}
