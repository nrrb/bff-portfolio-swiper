export const reactionLabels = { pass: 'PASS', superlike: 'SUPER LIKE', like: 'LIKE' };
export const initialState = { history: [], currentAppId: null, status: 'Explore the apps · likes last until you reload' };

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
    status: `${reactionLabels[action.type]} · ${action.name}`,
  };
}

export function appReactions(history) {
  return Object.fromEntries(history.map(({ appId, type }) => [appId, type]));
}
