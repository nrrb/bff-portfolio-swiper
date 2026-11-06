import React from 'react';

export default function AuthorCard({ photo, children }) {
  return (
    <article className="author-card card" aria-labelledby="owner-name">
      <img className="author-photo" src={photo.src}
        alt={photo.alt} width={photo.width} height={photo.height} draggable={false} />
      <div className="profile-copy author-copy">{children}</div>
    </article>
  );
}
