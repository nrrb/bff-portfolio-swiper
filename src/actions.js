export const reactionLabels = { pass: 'PASS', superlike: 'SUPER LIKE', like: 'LIKE' };
export const initialState = { history: [], currentAppId: null, status: 'Everyone here already likes you. Make your move.' };

export function reactionReducer(state, action) {
  if (action.type === 'select') return { ...state, currentAppId: action.appId };
  if (action.type === 'undo') {
    const last = state.history.at(-1);
    return {
      ...state,
      history: state.history.slice(0, -1),
      currentAppId: last ? last.appId : state.currentAppId,
      status: last ? `Undid ${last.type}` : 'Nothing to undo yet',
    };
  }
  if (!reactionLabels[action.type] || !action.appId) return state;
  return {
    ...state,
    history: [...state.history, { appId: action.appId, type: action.type }],
    currentAppId: action.nextAppId ?? action.appId,
    status: `${action.type === 'pass' ? 'Passed' : 'It’s a match'} · ${action.name}`,
  };
}

export function appReactions(history) {
  return Object.fromEntries(history.map(({ appId, type }) => [appId, type]));
}
