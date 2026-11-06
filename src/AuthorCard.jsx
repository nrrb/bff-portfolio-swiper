import React from 'react';

export default function AuthorCard({ name, children }) {
  return (
    <article className="author-card card" aria-labelledby="owner-name">
      <img className="author-photo" src="/author-photos/smiling_sun_beard_park.webp"
        alt={`${name} smiling outdoors in a park`} width="1320" height="1760" draggable={false} />
      <div className="profile-copy author-copy">{children}</div>
    </article>
  );
}
