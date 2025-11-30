let CELL_SIZE, COLS, ROWS, SOCKET_EVENTS;

const mapContainer = document.getElementById('map-container');
const deleteBtn = document.getElementById('delete-selected');
const exitSessionBtn = document.getElementById('exit-session-btn');

const STORAGE_KEYS = {
  SESSION: 'ttrpgSession',
  TOKENS: (sessionId) => `ttrpgMapTokens:${sessionId}`
};

const tokenState = new Map();

let tokenIdCounter = 1;
let selectedToken = null;
let draggingToken = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let pendingSessionData = null;
let currentDisplayName = '';
let socket = null;
let isConnected = false;
let isGM = false;
let currentSessionId = null;

if (exitSessionBtn) {
  exitSessionBtn.addEventListener('click', exitCurrentSession);
}

// Initialize socket connection
function initSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io('http://localhost:3000');

  socket.on('connect', () => {
    console.log('Connected to server');
    isConnected = true;
    updateConnectionStatus(true);
    attemptAutoReconnect();
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    isConnected = false;
    updateConnectionStatus(false);
  });

  // Session created
  socket.on(SOCKET_EVENTS.SESSION_CREATED, (data) => {
    console.log('Session created:', data);
    handleSessionReady(data);
  });

  // Session joined
  socket.on(SOCKET_EVENTS.SESSION_JOINED, (data) => {
    console.log('Session joined:', data);
    handleSessionReady(data);
  });

  // Player joined notification
  socket.on(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
    console.log('Player joined:', data.playerName);
    updatePlayerList(data.players);
    showNotification(`${data.playerName} joined the game`);
  });

  // Player left notification
  socket.on(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
    console.log('Player left:', data.playerName);
    updatePlayerList(data.players);
    showNotification(`${data.playerName} left the game`);
  });

  // GM disconnected
  socket.on(SOCKET_EVENTS.GM_DISCONNECTED, (data) => {
    clearStoredTokens(currentSessionId);
    clearStoredSession();
    alert(data.message);
    location.reload();
  });

  // Token added by GM
  socket.on(SOCKET_EVENTS.TOKEN_ADDED, (token) => {
    createTokenElement(token);
    upsertTokenState(token);
  });

  // Token moved by GM
  socket.on(SOCKET_EVENTS.TOKEN_MOVED, (data) => {
    console.log('Token moved event received:', data);
    const tokenEl = document.querySelector(`[data-id="${data.id}"]`);
    if (tokenEl) {
      console.log('Token found, updating position to:', data.col, data.row);
      positionToken(tokenEl, data.col, data.row);
      updateStoredTokenPosition(data.id, data.col, data.row);
    } else {
      console.warn('Token not found with id:', data.id);
    }
  });

  // Token deleted by GM
  socket.on(SOCKET_EVENTS.TOKEN_DELETED, (data) => {
    console.log('Token deleted event received:', data);
    const tokenEl = document.querySelector(`[data-id="${data.id}"]`);
    if (tokenEl) {
      tokenEl.remove();
      if (selectedToken === tokenEl) {
        selectedToken = null;
      }
      removeTokenState(data.id);
    } else {
      console.warn('Token to delete not found with id:', data.id);
    }
  });

  // Permission denied
  socket.on(SOCKET_EVENTS.PERMISSION_DENIED, (data) => {
    alert(data.message);
  });

  // Session error
  socket.on(SOCKET_EVENTS.SESSION_ERROR, (data) => {
    alert(data.message);
  });
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    statusEl.textContent = connected ? '● Connected' : '○ Disconnected';
    statusEl.style.color = connected ? '#4caf50' : '#f44336';
  }
}

function updatePlayerList(players = []) {
  const listEl = document.getElementById('player-list');
  if (listEl) {
    listEl.innerHTML = players.map(p => 
      `<div class="player-item">${p.name} ${p.isGM ? '(GM)' : ''}</div>`
    ).join('');
  }
}

function updateGMControls() {
  const addButtons = document.querySelectorAll('[data-add-token]');
  addButtons.forEach(btn => {
    btn.disabled = !isGM;
    btn.style.opacity = isGM ? '1' : '0.5';
  });
  
  const gmBadge = document.getElementById('gm-badge');
  if (gmBadge) {
    gmBadge.style.display = isGM ? 'block' : 'none';
  }
  
  const sessionInfo = document.getElementById('session-info');
  if (sessionInfo && (currentSessionId || loadStoredSession()?.sessionId)) {
    const sessionIdToShow = currentSessionId || loadStoredSession()?.sessionId || '—';
    sessionInfo.innerHTML = `
      <strong>Session ID:</strong> ${sessionIdToShow}<br/>
      <strong>Role:</strong> ${isGM ? 'Game Master' : 'Player'}
    `;
  } else if (sessionInfo) {
    sessionInfo.innerHTML = '';
  }

  updateSessionControls();
}

function showNotification(message) {
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

function hideSessionModal() {
  const modal = document.getElementById('session-modal');
  console.log('hideSessionModal called');
  if (modal) {
    modal.style.display = 'none';
    console.log('Modal hidden');
  }
}

function showSessionModal() {
  const modal = document.getElementById('session-modal');
  console.log('showSessionModal called, modal element:', modal);
  if (modal) {
    prefillSessionModal();
    modal.style.display = 'flex';
    console.log('Modal display set to flex');
  } else {
    console.error('Modal element not found!');
  }
}

// Initialize everything on load
window.addEventListener('DOMContentLoaded', () => {
  // Load shared constants first
  if (window.SHARED_CONSTANTS) {
    CELL_SIZE = window.SHARED_CONSTANTS.GRID_CONFIG.CELL_SIZE;
    COLS = window.SHARED_CONSTANTS.GRID_CONFIG.COLS;
    ROWS = window.SHARED_CONSTANTS.GRID_CONFIG.ROWS;
    SOCKET_EVENTS = window.SHARED_CONSTANTS.SOCKET_EVENTS;
    console.log('Shared constants loaded:', SOCKET_EVENTS);
  } else {
    console.error('Shared constants not loaded! Check if /shared/constants.js is loading.');
  }

  const storedSession = loadStoredSession();
  if (storedSession?.sessionId) {
    currentSessionId = storedSession.sessionId;
    isGM = !!storedSession.isGM;
    currentDisplayName = storedSession.displayName || '';
    const storedTokens = loadStoredTokens(storedSession.sessionId);
    if (storedTokens.length) {
      replaceTokens(storedTokens);
    }
  } else {
    currentSessionId = null;
    isGM = false;
  }

  updateGMControls();
  showSessionModal();
  
  // Initialize socket connection
  initSocket();
  
  // Session modal handlers
  document.getElementById('create-session-btn').addEventListener('click', () => {
    const sessionId = document.getElementById('create-session-id').value.trim();
    const gmName = document.getElementById('gm-name').value.trim();
    
    if (!sessionId) {
      alert('Please enter a session ID');
      return;
    }
    
    if (!socket) {
      alert('Not connected to server yet. Please wait...');
      return;
    }

    pendingSessionData = {
      sessionId,
      displayName: gmName || 'Game Master',
      isGM: true
    };
    
    console.log('Creating session with event:', SOCKET_EVENTS.CREATE_SESSION);
    socket.emit(SOCKET_EVENTS.CREATE_SESSION, {
      sessionId: sessionId,
      gmName: gmName || 'Game Master'
    });
  });
  
  document.getElementById('join-session-btn').addEventListener('click', () => {
    const sessionId = document.getElementById('join-session-id').value.trim();
    const playerName = document.getElementById('player-name').value.trim();
    
    if (!sessionId) {
      alert('Please enter a session ID');
      return;
    }
    
    if (!playerName) {
      alert('Please enter your name');
      return;
    }
    
    if (!socket) {
      alert('Not connected to server yet. Please wait...');
      return;
    }

    pendingSessionData = {
      sessionId,
      displayName: playerName,
      isGM: false
    };
    
    console.log('Joining session with event:', SOCKET_EVENTS.JOIN_SESSION);
    socket.emit(SOCKET_EVENTS.JOIN_SESSION, {
      sessionId: sessionId,
      playerName: playerName
    });
  });
});

document.querySelectorAll('[data-add-token]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!isGM) {
      alert('Only the Game Master can add tokens');
      return;
    }
    const type = btn.getAttribute('data-add-token');
    addToken(type);
  });
});

deleteBtn.addEventListener('click', () => {
  if (!isGM) {
    alert('Only the Game Master can delete tokens');
    return;
  }
  if (selectedToken) {
    const tokenId = selectedToken.dataset.id;
    selectedToken.remove();
    selectedToken = null;
    removeTokenState(tokenId);
    
    // Emit delete event to server
    if (socket && currentSessionId) {
      socket.emit(SOCKET_EVENTS.DELETE_TOKEN, { id: tokenId });
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' && selectedToken) {
    if (!isGM) {
      alert('Only the Game Master can delete tokens');
      return;
    }
    const tokenId = selectedToken.dataset.id;
    selectedToken.remove();
    selectedToken = null;
    removeTokenState(tokenId);
    
    // Emit delete event to server
    if (socket && currentSessionId) {
      socket.emit(SOCKET_EVENTS.DELETE_TOKEN, { id: tokenId });
    }
  }
});

function addToken(type) {
  const tokenId = tokenIdCounter++;
  const startCol = Math.floor(COLS / 2);
  const startRow = Math.floor(ROWS / 2);
  const label = labelForType(type);

  const tokenData = {
    id: tokenId,
    type: type,
    col: startCol,
    row: startRow,
    label: label
  };

  // Create token element locally
  createTokenElement(tokenData);
  upsertTokenState(tokenData);

  // Emit to server
  if (socket && currentSessionId) {
    socket.emit(SOCKET_EVENTS.ADD_TOKEN, tokenData);
  }
}

function createTokenElement(tokenData) {
  // Check if token already exists
  if (document.querySelector(`[data-id="${tokenData.id}"]`)) {
    return;
  }

  const div = document.createElement('div');
  div.classList.add('token', tokenData.type);
  div.dataset.id = tokenData.id;
  div.dataset.type = tokenData.type;
  div.textContent = tokenData.label;
  positionToken(div, tokenData.col, tokenData.row);
  div.addEventListener('mousedown', onTokenMouseDown);
  div.addEventListener('click', onTokenClick);
  mapContainer.appendChild(div);

  // Update tokenIdCounter if needed
  if (tokenData.id >= tokenIdCounter) {
    tokenIdCounter = tokenData.id + 1;
  }
}

function labelForType(type) {
  switch (type) {
    case 'pc': return 'PC';
    case 'monster': return 'M';
    case 'npc': return 'NPC';
    case 'prop-tree': return '🌳';
    case 'prop-rock': return '🪨';
    case 'building': return '🏠';
    default: return '?';
  }
}

function positionToken(el, col, row) {
  col = Math.max(0, Math.min(COLS - 1, col));
  row = Math.max(0, Math.min(ROWS - 1, row));
  el.style.left = (col * CELL_SIZE + 2) + 'px';
  el.style.top = (row * CELL_SIZE + 2) + 'px';
  el.dataset.col = col;
  el.dataset.row = row;
}

function onTokenClick(e) {
  e.stopPropagation();
  selectToken(e.currentTarget);
}

function selectToken(tokenEl) {
  if (selectedToken) selectedToken.classList.remove('selected');
  selectedToken = tokenEl;
  if (selectedToken) selectedToken.classList.add('selected');
}

mapContainer.addEventListener('mousedown', (e) => {
  if (e.target === mapContainer || e.target.id === 'grid') selectToken(null);
});

function onTokenMouseDown(e) {
  if (!isGM) {
    return; // Only GM can drag tokens
  }
  e.preventDefault();
  draggingToken = e.currentTarget;
  draggingToken.classList.add('dragging');
  draggingToken.style.zIndex = '200';
  const tokenRect = draggingToken.getBoundingClientRect();
  dragOffsetX = e.clientX - tokenRect.left;
  dragOffsetY = e.clientY - tokenRect.top;
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  if (!draggingToken) return;
  const rect = mapContainer.getBoundingClientRect();
  let x = e.clientX - rect.left - dragOffsetX;
  let y = e.clientY - rect.top - dragOffsetY;
  const maxX = rect.width - draggingToken.offsetWidth;
  const maxY = rect.height - draggingToken.offsetHeight;
  x = Math.max(0, Math.min(maxX, x));
  y = Math.max(0, Math.min(maxY, y));
  draggingToken.style.left = x + 'px';
  draggingToken.style.top = y + 'px';
}

function onMouseUp(e) {
  if (!draggingToken) return;
  const rect = mapContainer.getBoundingClientRect();
  const tokenRect = draggingToken.getBoundingClientRect();
  const x = tokenRect.left - rect.left;
  const y = tokenRect.top - rect.top;
  let col = Math.round(x / CELL_SIZE);
  let row = Math.round(y / CELL_SIZE);
  positionToken(draggingToken, col, row);
  updateStoredTokenPosition(draggingToken.dataset.id, col, row);
  
  // Emit move event to server
  if (socket && currentSessionId) {
    socket.emit(SOCKET_EVENTS.MOVE_TOKEN, {
      id: draggingToken.dataset.id,
      col: col,
      row: row
    });
  }
  
  draggingToken.classList.remove('dragging');
  draggingToken.style.zIndex = 'auto';
  draggingToken = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

function handleSessionReady(data) {
  isGM = data.isGM;
  currentSessionId = data.sessionId;
  currentDisplayName = pendingSessionData?.displayName || currentDisplayName || (isGM ? 'Game Master' : 'Player');

  hideSessionModal();
  updatePlayerList(data.players);
  updateGMControls();

  const serverTokens = Array.isArray(data.tokens) ? data.tokens : [];
  if (serverTokens.length) {
    replaceTokens(serverTokens);
  } else {
    const storedTokens = loadStoredTokens(currentSessionId);
    if (storedTokens.length) {
      replaceTokens(storedTokens);
      if (isGM && socket) {
        storedTokens.forEach(token => socket.emit(SOCKET_EVENTS.ADD_TOKEN, token));
      }
    } else {
      replaceTokens([]);
    }
  }

  persistSessionState({
    sessionId: currentSessionId,
    isGM,
    displayName: currentDisplayName
  });

  pendingSessionData = null;
  showNotification(isGM ? 'Session ready. You are the GM.' : 'Joined session successfully.');
}

function replaceTokens(tokens) {
  if (!Array.isArray(tokens)) tokens = [];
  clearBoardTokens();
  tokenState.clear();
  tokens.forEach(token => {
    const normalized = normalizeToken(token);
    tokenState.set(String(normalized.id), normalized);
    createTokenElement(normalized);
  });
  persistTokenState();
}

function clearBoardTokens() {
  if (!mapContainer) return;
  const existingTokens = mapContainer.querySelectorAll('.token');
  existingTokens.forEach(token => token.remove());
  selectedToken = null;
  draggingToken = null;
  tokenIdCounter = 1;
}

function normalizeToken(token) {
  return {
    id: typeof token.id === 'string' ? parseInt(token.id, 10) : token.id,
    type: token.type,
    col: Number(token.col),
    row: Number(token.row),
    label: token.label
  };
}

function upsertTokenState(token) {
  if (!currentSessionId || !token) return;
  const normalized = normalizeToken(token);
  tokenState.set(String(normalized.id), normalized);
  persistTokenState();
}

function updateStoredTokenPosition(tokenId, col, row) {
  if (!currentSessionId) return;
  const key = String(tokenId);
  const existing = tokenState.get(key) || getTokenSnapshot(tokenId);
  if (!existing) return;
  tokenState.set(key, {
    ...existing,
    col: Number(col),
    row: Number(row)
  });
  persistTokenState();
}

function removeTokenState(tokenId) {
  if (!currentSessionId) return;
  tokenState.delete(String(tokenId));
  persistTokenState();
}

function persistTokenState() {
  if (!currentSessionId) return;
  const serialized = JSON.stringify(Array.from(tokenState.values()));
  safeStorageSet(STORAGE_KEYS.TOKENS(currentSessionId), serialized);
}

function loadStoredTokens(sessionId) {
  if (!sessionId) return [];
  const raw = safeStorageGet(STORAGE_KEYS.TOKENS(sessionId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse stored tokens', err);
    return [];
  }
}

function clearStoredTokens(sessionId) {
  if (!sessionId) return;
  safeStorageRemove(STORAGE_KEYS.TOKENS(sessionId));
}

function persistSessionState(data) {
  if (!data || !data.sessionId) return;
  currentDisplayName = data.displayName || currentDisplayName || '';
  safeStorageSet(STORAGE_KEYS.SESSION, JSON.stringify({
    sessionId: data.sessionId,
    isGM: !!data.isGM,
    displayName: currentDisplayName
  }));
}

function loadStoredSession() {
  const raw = safeStorageGet(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse stored session', err);
    return null;
  }
}

function clearStoredSession() {
  safeStorageRemove(STORAGE_KEYS.SESSION);
  currentDisplayName = '';
}

function safeStorageGet(key) {
  try {
    return window.localStorage ? window.localStorage.getItem(key) : null;
  } catch (err) {
    console.warn('LocalStorage get failed', err);
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn('LocalStorage set failed', err);
  }
}

function safeStorageRemove(key) {
  try {
    if (window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('LocalStorage remove failed', err);
  }
}

function attemptAutoReconnect() {
  if (!socket || !socket.connected) return;
  const stored = loadStoredSession();
  if (!stored?.sessionId) return;

  pendingSessionData = { ...stored };
  console.log('Attempting to restore previous session:', stored.sessionId);
  showNotification('Restoring your previous session…');

  if (stored.isGM) {
    socket.emit(SOCKET_EVENTS.CREATE_SESSION, {
      sessionId: stored.sessionId,
      gmName: stored.displayName || 'Game Master'
    });
  } else {
    socket.emit(SOCKET_EVENTS.JOIN_SESSION, {
      sessionId: stored.sessionId,
      playerName: stored.displayName || 'Player'
    });
  }
}

function prefillSessionModal() {
  const stored = loadStoredSession();
  if (!stored) return;

  const createSessionInput = document.getElementById('create-session-id');
  if (createSessionInput) {
    createSessionInput.value = stored.sessionId || '';
  }

  const gmNameInput = document.getElementById('gm-name');
  if (gmNameInput && stored.isGM) {
    gmNameInput.value = stored.displayName || gmNameInput.value;
  }

  const joinSessionInput = document.getElementById('join-session-id');
  if (joinSessionInput) {
    joinSessionInput.value = stored.sessionId || '';
  }

  const playerNameInput = document.getElementById('player-name');
  if (playerNameInput && !stored.isGM) {
    playerNameInput.value = stored.displayName || '';
  }
}

function exitCurrentSession() {
  const stored = loadStoredSession();
  if (!currentSessionId && !stored) {
    showNotification('No active session to exit.');
    return;
  }

  const sessionToClear = currentSessionId || stored?.sessionId;
  clearStoredTokens(sessionToClear);
  clearStoredSession();
  tokenState.clear();

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  isGM = false;
  isConnected = false;
  currentSessionId = null;
  pendingSessionData = null;
  clearBoardTokens();
  updatePlayerList([]);
  updateGMControls();
  updateConnectionStatus(false);
  showSessionModal();

  initSocket();
}

function updateSessionControls() {
  if (!exitSessionBtn) return;
  const hasStoredSession = !!(currentSessionId || loadStoredSession());
  exitSessionBtn.disabled = !hasStoredSession;
  exitSessionBtn.style.visibility = hasStoredSession ? 'visible' : 'hidden';
}

function getTokenSnapshot(tokenId) {
  const el = document.querySelector(`[data-id="${tokenId}"]`);
  if (!el) return null;
  return {
    id: typeof tokenId === 'string' ? parseInt(tokenId, 10) : tokenId,
    col: Number(el.dataset.col),
    row: Number(el.dataset.row),
    type: el.dataset.type,
    label: el.textContent
  };
}
// JS from canvas placed here
