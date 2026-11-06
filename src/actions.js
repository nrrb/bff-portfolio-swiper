import { copy } from './data.js';

export const reactionLabels = copy.reactions;

export function createInitialState(appIds) {
  return { queue: appIds, history: [], currentAppId: appIds[0] ?? null, status: copy.status.initial };
}

export function reactionReducer(state, action) {
  if (action.type === 'select') {
    return {
      ...state,
      currentAppId: action.appId,
      queue: state.queue.includes(action.appId) ? [action.appId, ...state.queue.filter(id => id !== action.appId)] : state.queue,
    };
  }
  if (action.type === 'undo') {
    const last = state.history.at(-1);
    return {
      ...state,
      history: state.history.slice(0, -1),
      queue: last ? last.queue : state.queue,
      currentAppId: last ? last.appId : state.currentAppId,
      status: last ? copy.status.undid[last.type] : copy.status.nothingToUndo,
    };
  }
  if (!reactionLabels[action.type] || !action.appId) return state;
  const remaining = state.queue.filter(id => id !== action.appId);
  const queue = action.type === 'pass' ? [...remaining, action.appId] : remaining;
  return {
    ...state,
    queue,
    history: [...state.history, { appId: action.appId, type: action.type, queue: state.queue }],
    currentAppId: queue[0] ?? null,
    status: `${action.type === 'pass' ? copy.status.passed : copy.status.matched} · ${action.name}`,
  };
}

export function appReactions(history) {
  return Object.fromEntries(history.map(({ appId, type }) => [appId, type]));
}
