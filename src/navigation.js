export const views = [
  { id: 'home', label: 'Home', icon: 'flame' },
  { id: 'browser', label: 'Browser', icon: 'compass' },
  { id: 'likes', label: 'Likes', icon: 'heart-outline' },
  { id: 'contact', label: 'Contact', icon: 'chats' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
];

export function viewFromHash(hash) {
  const id = hash.slice(1);
  return views.some(view => view.id === id) ? id : 'home';
}

export function subscribeToNavigation(callback) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function currentView() {
  return viewFromHash(window.location.hash);
}
