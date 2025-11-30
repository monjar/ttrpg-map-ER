import { state } from './state.js';
import {
  updateConnectionStatus,
  updatePlayerList,
  showNotification
} from './ui.js';
import {
  handleSessionReady,
  attemptAutoReconnect
} from './session.js';
import {
  handleIncomingTokenAdd,
  handleIncomingTokenMove,
  handleIncomingTokenDelete
} from './tokens.js';
import { clearStoredTokens, clearStoredSession } from './storage.js';

export function initializeSocket() {
  if (state.socket) {
    state.socket.removeAllListeners();
    state.socket.disconnect();
  }

  state.socket = io('http://localhost:3000');
  const socket = state.socket;

  socket.on('connect', () => {
    state.isConnected = true;
    updateConnectionStatus(true);
    attemptAutoReconnect();
  });

  socket.on('disconnect', () => {
    state.isConnected = false;
    updateConnectionStatus(false);
  });

  socket.on(state.SOCKET_EVENTS.SESSION_CREATED, handleSessionReady);
  socket.on(state.SOCKET_EVENTS.SESSION_JOINED, handleSessionReady);

  socket.on(state.SOCKET_EVENTS.PLAYER_JOINED, (data) => {
    updatePlayerList(data.players);
    showNotification(`${data.playerName} joined the game`);
  });

  socket.on(state.SOCKET_EVENTS.PLAYER_LEFT, (data) => {
    updatePlayerList(data.players);
    showNotification(`${data.playerName} left the game`);
  });

  socket.on(state.SOCKET_EVENTS.GM_DISCONNECTED, (data) => {
    if (state.currentSessionId) {
      clearStoredTokens(state.currentSessionId);
    }
    clearStoredSession();
    alert(data.message);
    window.location.reload();
  });

  socket.on(state.SOCKET_EVENTS.TOKEN_ADDED, handleIncomingTokenAdd);
  socket.on(state.SOCKET_EVENTS.TOKEN_MOVED, handleIncomingTokenMove);
  socket.on(state.SOCKET_EVENTS.TOKEN_DELETED, handleIncomingTokenDelete);

  socket.on(state.SOCKET_EVENTS.PERMISSION_DENIED, (data) => {
    alert(data.message);
  });

  socket.on(state.SOCKET_EVENTS.SESSION_ERROR, (data) => {
    alert(data.message);
  });
}
