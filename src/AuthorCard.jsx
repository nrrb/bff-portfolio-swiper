import React, { useRef, useState } from 'react';

const photos = [
  { file: 'smiling_sun_beard_park.webp', description: 'smiling outdoors in a park', position: '40% center' },
  { file: 'smiling_sun_hat_beard.webp', description: 'wearing an orange hat in the sunshine', position: '43% center' },
  { file: 'smiling_hat_beard_desk.webp', description: 'smiling in a pink hat and white shirt', position: '30% center' },
];

export default function AuthorCard({ name, children }) {
  const track = useRef(null);
  const pointer = useRef(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);

  function showPhoto(next) {
    const target = Math.max(0, Math.min(photos.length - 1, next));
    track.current.scrollTo({ left: target * track.current.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function startDrag(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    pointer.current = { id: event.pointerId, x: event.clientX, scroll: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event) {
    const drag = pointer.current;
    if (drag?.id === event.pointerId) event.currentTarget.scrollLeft = drag.scroll + drag.x - event.clientX;
  }

  function endDrag(event) {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    showPhoto(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth));
  }

  return (
    <article className="author-card" aria-labelledby="owner-name">
      <div className="author-gallery" role="group" aria-roledescription="carousel" aria-label={`Photos of ${name}`}>
        <div className="author-photo-track" ref={track} tabIndex={0} aria-label="Photo gallery. Use the arrow keys to change photos."
          data-dragging={dragging || undefined} onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
          onDragStart={event => event.preventDefault()}
          onScroll={event => setIndex(Math.max(0, Math.min(photos.length - 1, Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))))}
          onKeyDown={event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              showPhoto(index + (event.key === 'ArrowLeft' ? -1 : 1));
            }
          }}>
          {photos.map((photo, photoIndex) => (
            <img key={photo.file} src={`/author-photos/${photo.file}`} alt={`${name} ${photo.description}`}
              width="1320" height="1760" draggable={false} loading={photoIndex ? 'lazy' : 'eager'}
              style={{ objectPosition: photo.position }} />
          ))}
        </div>
        <div className="author-photo-progress" aria-label="Choose a photo">
          {photos.map((photo, photoIndex) => <button key={photo.file} aria-label={`Show photo ${photoIndex + 1} of ${photos.length}`}
            aria-current={index === photoIndex ? 'true' : undefined} onClick={() => showPhoto(photoIndex)}><span /></button>)}
        </div>
        <button className="photo-arrow photo-previous" aria-label="Previous photo" disabled={!index} onClick={() => showPhoto(index - 1)}>‹</button>
        <button className="photo-arrow photo-next" aria-label="Next photo" disabled={index === photos.length - 1} onClick={() => showPhoto(index + 1)}>›</button>
        <span className="photo-counter" role="status">{index + 1} / {photos.length}</span>
      </div>
      <div className="author-copy">{children}</div>
    </article>
  );
}
