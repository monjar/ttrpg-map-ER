import { state, elements } from './state.js';
import {
  loadStoredSession,
  persistSessionState,
  clearStoredSession,
  loadStoredTokens,
  clearStoredTokens
} from './storage.js';
import {
  replaceTokens,
  clearTokens
} from './tokens.js';
import {
  updatePlayerList,
  updateGMControls,
  updateConnectionStatus,
  showNotification,
  hideSessionModal,
  showSessionModal,
  setExitButtonState
} from './ui.js';

let onSessionExit = null;

export function registerSessionExitHandler(handler) {
  onSessionExit = handler;
}

export function initSessionControls() {
  const createBtn = document.getElementById('create-session-btn');
  const joinBtn = document.getElementById('join-session-btn');

  if (createBtn) {
    createBtn.addEventListener('click', handleCreateSession);
  }
  if (joinBtn) {
    joinBtn.addEventListener('click', handleJoinSession);
  }
  if (elements.exitSessionBtn) {
    elements.exitSessionBtn.addEventListener('click', exitCurrentSession);
  }
}

export function bootstrapStoredSession() {
  const storedSession = loadStoredSession();
  if (storedSession?.sessionId) {
    state.currentSessionId = storedSession.sessionId;
    state.isGM = !!storedSession.isGM;
    state.currentDisplayName = storedSession.displayName || '';
    const storedTokens = loadStoredTokens(storedSession.sessionId);
    if (storedTokens.length) {
      replaceTokens(storedTokens);
    }
  } else {
    state.currentSessionId = null;
    state.isGM = false;
    state.currentDisplayName = '';
    clearTokens();
  }

  updateGMControls();
  setExitButtonState(Boolean(storedSession?.sessionId));
}

export function handleSessionReady(data) {
  state.isGM = data.isGM;
  state.currentSessionId = data.sessionId;
  state.currentDisplayName =
    state.pendingSessionData?.displayName ||
    state.currentDisplayName ||
    (state.isGM ? 'Game Master' : 'Player');

  hideSessionModal();
  updatePlayerList(data.players);
  updateGMControls();

  const serverTokens = Array.isArray(data.tokens) ? data.tokens : [];
  if (serverTokens.length) {
    replaceTokens(serverTokens);
  } else {
    const storedTokens = loadStoredTokens(state.currentSessionId);
    if (storedTokens.length) {
      replaceTokens(storedTokens);
      if (state.isGM && state.socket) {
        storedTokens.forEach((token) => {
          state.socket.emit(state.SOCKET_EVENTS.ADD_TOKEN, token);
        });
      }
    } else {
      replaceTokens([]);
    }
  }

  persistSessionState({
    sessionId: state.currentSessionId,
    isGM: state.isGM,
    displayName: state.currentDisplayName
  });

  state.pendingSessionData = null;
  showNotification(state.isGM ? 'Session ready. You are the GM.' : 'Joined session successfully.');
}

export function attemptAutoReconnect() {
  if (!state.socket || !state.socket.connected) return;
  const stored = loadStoredSession();
  if (!stored?.sessionId) return;

  state.pendingSessionData = { ...stored };
  showNotification('Restoring your previous session…');

  if (stored.isGM) {
    state.socket.emit(state.SOCKET_EVENTS.CREATE_SESSION, {
      sessionId: stored.sessionId,
      gmName: stored.displayName || 'Game Master'
    });
  } else {
    state.socket.emit(state.SOCKET_EVENTS.JOIN_SESSION, {
      sessionId: stored.sessionId,
      playerName: stored.displayName || 'Player'
    });
  }
}

export function exitCurrentSession() {
  const stored = loadStoredSession();
  if (!state.currentSessionId && !stored) {
    showNotification('No active session to exit.');
    return;
  }

  const sessionToClear = state.currentSessionId || stored?.sessionId;
  if (sessionToClear) {
    clearStoredTokens(sessionToClear);
  }
  clearStoredSession();
  clearTokens();

  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }

  state.isGM = false;
  state.isConnected = false;
  state.currentSessionId = null;
  state.pendingSessionData = null;
  state.currentDisplayName = '';

  updatePlayerList([]);
  updateGMControls();
  updateConnectionStatus(false);
  showSessionModal();

  if (typeof onSessionExit === 'function') {
    onSessionExit();
  }
}

function handleCreateSession() {
  const sessionIdInput = document.getElementById('create-session-id');
  const gmNameInput = document.getElementById('gm-name');
  const sessionId = sessionIdInput?.value.trim();
  const gmName = gmNameInput?.value.trim() || 'Game Master';

  if (!sessionId) {
    alert('Please enter a session ID');
    return;
  }

  if (!state.socket) {
    alert('Not connected to server yet. Please wait...');
    return;
  }

  state.pendingSessionData = {
    sessionId,
    displayName: gmName,
    isGM: true
  };

  state.socket.emit(state.SOCKET_EVENTS.CREATE_SESSION, {
    sessionId,
    gmName
  });
}

function handleJoinSession() {
  const sessionIdInput = document.getElementById('join-session-id');
  const playerNameInput = document.getElementById('player-name');
  const sessionId = sessionIdInput?.value.trim();
  const playerName = playerNameInput?.value.trim();

  if (!sessionId) {
    alert('Please enter a session ID');
    return;
  }

  if (!playerName) {
    alert('Please enter your name');
    return;
  }

  if (!state.socket) {
    alert('Not connected to server yet. Please wait...');
    return;
  }

  state.pendingSessionData = {
    sessionId,
    displayName: playerName,
    isGM: false
  };

  state.socket.emit(state.SOCKET_EVENTS.JOIN_SESSION, {
    sessionId,
    playerName
  });
}
