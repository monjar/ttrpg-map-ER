export const STORAGE_KEYS = {
  SESSION: 'ttrpgSession',
  tokens: (sessionId) => (sessionId ? `ttrpgMapTokens:${sessionId}` : null)
};

function isStorageAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (err) {
    console.warn('LocalStorage unavailable', err);
    return false;
  }
}

export function safeStorageGet(key) {
  if (!isStorageAvailable() || !key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn('LocalStorage get failed', err);
    return null;
  }
}

export function safeStorageSet(key, value) {
  if (!isStorageAvailable() || !key) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn('LocalStorage set failed', err);
  }
}

export function safeStorageRemove(key) {
  if (!isStorageAvailable() || !key) return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn('LocalStorage remove failed', err);
  }
}

export function persistSessionState(data) {
  if (!data || !data.sessionId) return;
  safeStorageSet(STORAGE_KEYS.SESSION, JSON.stringify({
    sessionId: data.sessionId,
    isGM: !!data.isGM,
    displayName: data.displayName || ''
  }));
}

export function loadStoredSession() {
  const raw = safeStorageGet(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse stored session', err);
    return null;
  }
}

export function clearStoredSession() {
  safeStorageRemove(STORAGE_KEYS.SESSION);
}

export function persistTokens(sessionId, tokens = []) {
  const key = STORAGE_KEYS.tokens(sessionId);
  if (!key) return;
  safeStorageSet(key, JSON.stringify(tokens));
}

export function loadStoredTokens(sessionId) {
  const key = STORAGE_KEYS.tokens(sessionId);
  if (!key) return [];
  const raw = safeStorageGet(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse stored tokens', err);
    return [];
  }
}

export function clearStoredTokens(sessionId) {
  const key = STORAGE_KEYS.tokens(sessionId);
  if (!key) return;
  safeStorageRemove(key);
}
