import { copy } from './data.js';

export const views = [
  { id: 'home', label: copy.navigation.home, icon: 'flame' },
  { id: 'browser', label: copy.navigation.browser, icon: 'compass' },
  { id: 'likes', label: copy.navigation.likes, icon: 'heart-outline' },
  { id: 'chats', label: copy.navigation.chats, icon: 'chats' },
  { id: 'profile', label: copy.navigation.profile, icon: 'profile' },
];

export function viewFromHash(hash) {
  const id = hash.slice(1);
  if (/^chats\/[\w.-]+$/.test(id)) return id;
  return views.some(view => view.id === id) ? id : 'home';
}

export function subscribeToNavigation(callback) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function currentView() {
  return viewFromHash(window.location.hash);
}
