import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apps, owner } from '../../src/data.js';
import { instructions, formatInstruction, parseTour, exampleTour } from './lexicon.js';
import './builder.css';

let nextKey = 0;
const makeStep = (id, value = '') => ({ key: nextKey++, id, value });

function Builder() {
  const [steps, setSteps] = useState(() => parseTour(exampleTour).map(step => makeStep(step.id, step.value)));
  const [notice, setNotice] = useState('');
  function insert(id, index = steps.length) {
    const definition = instructions.find(item => item.id === id);
    if (!definition) return;
    const value = definition.parameter === 'seconds' ? '2' : definition.parameter === 'project' ? apps[0]?.name || '' : definition.parameter === 'contact' ? owner.links[0]?.label || '' : '';
    const next = [...steps];
    next.splice(index, 0, makeStep(id, value));
    setSteps(next);
    setNotice(`Added ${definition.phrase}`);
  }
  function move(key, index) {
    const next = [...steps];
    const from = next.findIndex(step => step.key === key);
    if (from < 0) return;
    const [step] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(index, next.length)), 0, step);
    setSteps(next);
    setNotice(`Moved step to position ${next.indexOf(step) + 1}`);
  }
  function drop(event, index) {
    event.preventDefault(); event.stopPropagation();
    try {
      const data = JSON.parse(event.dataTransfer.getData('application/x-tour-step'));
      if (data.instruction) insert(data.instruction, index);
      else if (Number.isInteger(data.key)) move(data.key, index);
    } catch { setNotice('Drop an instruction or tour step here.'); }
  }
  function drag(event, data) {
    event.dataTransfer.setData('application/x-tour-step', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'copyMove';
  }
  const errors = [];
  const text = steps.map((step, index) => {
    try { return formatInstruction(step.id, step.value); }
    catch (error) { errors.push(`Step ${index + 1}: ${error.message}`); return `[Step ${index + 1} needs a value]`; }
  }).join('\n');
  if (!steps.length) errors.push('Add at least one instruction.');
  else if (steps[0].id !== 'open') errors.push('The first instruction must be Open app.');
  function download() {
    if (errors.length) return;
    const url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'tour.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Downloaded tour.txt');
  }
  return <main>
    <header><div><p className="eyebrow">LOCAL STUDIO · WEBM DEMOS</p><h1>Build a product tour<span>.</span></h1><p>Arrange the story. Export the script. Record your portfolio.</p></div><a href="/" target="_blank" rel="noreferrer">Open portfolio ↗</a></header>
    <div className="workspace">
      <section className="palette" aria-labelledby="palette-title"><div className="section-heading"><span>01</span><h2 id="palette-title">Instructions</h2></div><p className="hint">Drag into your tour, or select Add.</p>
        {instructions.map(item => <article className="instruction" key={item.id} draggable onDragStart={event => drag(event, { instruction: item.id })}>
          <div><h3>{item.phrase}{item.parameter && (item.parameter === 'seconds' ? ' N seconds' : ' "Name"')}</h3><button aria-label={`Add ${item.phrase}`} onClick={() => insert(item.id)}>+ Add</button></div><p>{item.note}</p>{item.aliases?.length > 0 && <small>Also accepts: {item.aliases.join(', ')}</small>}
        </article>)}
      </section>
      <section className="sequence" aria-labelledby="tour-title"><div className="section-heading"><span>02</span><h2 id="tour-title">Your tour</h2><span className="total">{steps.length} steps</span></div><p className="hint">Drop on a step to move there, or below the list to append. Buttons work with keyboard and touch.</p>
        <ol aria-label="Tour steps">{steps.map((step, index) => {
          const item = instructions.find(item => item.id === step.id);
          const options = item.parameter === 'project' ? apps.map(app => app.name) : owner.links.map(link => link.label);
          return <li key={step.key} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, index)}>
            <div className="step-heading"><span className="handle" role="img" draggable onDragStart={event => drag(event, { key: step.key })} aria-label={`Drag step ${index + 1}`} title="Drag to reorder">⠿</span><span className="step-number">{String(index + 1).padStart(2, '0')}</span><h3>{item.phrase}</h3></div>
            <p>{item.note}</p>
            {item.parameter && <label>{item.parameter === 'seconds' ? 'Seconds' : item.parameter === 'project' ? 'Project' : 'Contact'}
              {item.parameter === 'seconds' ? <input type="number" min="0.01" max="60" step="any" value={step.value} onChange={event => setSteps(steps.map(current => current.key === step.key ? { ...current, value: event.target.value } : current))} /> : <select value={step.value} onChange={event => setSteps(steps.map(current => current.key === step.key ? { ...current, value: event.target.value } : current))}><option value="">Choose a name</option>{[...new Set(options)].map(name => <option key={name}>{name}</option>)}</select>}
            </label>}
            <div className="step-controls"><button disabled={index === 0} aria-label={`Move step ${index + 1} up`} onClick={() => move(step.key, index - 1)}>↑ Up</button><button disabled={index === steps.length - 1} aria-label={`Move step ${index + 1} down`} onClick={() => move(step.key, index + 1)}>↓ Down</button><button className="remove" aria-label={`Remove step ${index + 1}`} onClick={() => { setSteps(steps.filter(current => current.key !== step.key)); setNotice('Removed step'); }}>Remove</button></div>
          </li>;
        })}</ol>
        <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => drop(event, steps.length)}>Drop an instruction or step here to append</div>
      </section>
      <section className="output" aria-labelledby="output-title"><div className="section-heading"><span>03</span><h2 id="output-title">The script</h2></div><p className="hint">One instruction per line. This is exactly what the recorder reads.</p><pre aria-label="Script preview">{text || 'Your tour starts here.'}</pre>
        {errors.length > 0 && <div className="errors" role="alert">{errors.map(error => <p key={error}>{error}</p>)}</div>}
        <button className="download" disabled={errors.length > 0} onClick={download}>Download tour.txt ↓</button>
        <div className="run-notes"><h3>Record it locally</h3><p>Keep the dev server running. Save the download in this repo, then run:</p><code>npm run demo -- tour.txt</code><p>For another server address, append <code>--url http://127.0.0.1:5174/</code>.</p><p>The recorder saves a 440 × 956 WebM in <code>recordings/</code>. External tabs are checked and closed; email never opens a mail app.</p><p>Starting states are checked during playback. Invalid actions stop at their line and preserve a partial video.</p><p>Edits live in this tab only. Download your script before closing.</p></div>
      </section>
    </div><p role="status" className="status">{notice}</p>
  </main>;
}
createRoot(document.getElementById('root')).render(<Builder />);
