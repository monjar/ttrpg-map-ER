import { state, elements, resetBoardState, resetDraggingState } from './state.js';
import { persistTokens } from './storage.js';

const tokenState = new Map();
let controlsInitialized = false;

export function initTokenControls() {
  if (controlsInitialized) return;
  controlsInitialized = true;

  const addButtons = document.querySelectorAll('[data-add-token]');
  addButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.isGM) {
        alert('Only the Game Master can add tokens');
        return;
      }
      addToken(btn.getAttribute('data-add-token'));
    });
  });

  if (elements.deleteBtn) {
    elements.deleteBtn.addEventListener('click', handleDeleteSelected);
  }

  if (elements.mapContainer) {
    elements.mapContainer.addEventListener('mousedown', handleMapMouseDown);
  }

  document.addEventListener('keydown', handleKeyDown);
}

export function handleIncomingTokenAdd(token) {
  createTokenElement(token);
  upsertTokenState(token);
}

export function handleIncomingTokenMove(data) {
  const tokenEl = document.querySelector(`[data-id="${data.id}"]`);
  if (tokenEl) {
    positionToken(tokenEl, data.col, data.row);
    updateStoredTokenPosition(data.id, data.col, data.row);
  }
}

export function handleIncomingTokenDelete(data) {
  const tokenEl = document.querySelector(`[data-id="${data.id}"]`);
  if (tokenEl) {
    tokenEl.remove();
    if (state.selectedToken === tokenEl) {
      state.selectedToken = null;
    }
    removeTokenState(data.id);
  }
}

export function replaceTokens(tokens = []) {
  clearBoardTokens();
  tokenState.clear();
  tokens.forEach((token) => {
    const normalized = normalizeToken(token);
    tokenState.set(String(normalized.id), normalized);
    createTokenElement(normalized);
  });
  persistTokenState();
}

export function clearTokens() {
  replaceTokens([]);
}

export function getAllTokens() {
  return Array.from(tokenState.values());
}

function addToken(type) {
  const tokenId = state.tokenIdCounter++;
  const startCol = Math.floor(state.COLS / 2);
  const startRow = Math.floor(state.ROWS / 2);

  const tokenData = {
    id: tokenId,
    type,
    col: startCol,
    row: startRow,
    label: labelForType(type)
  };

  createTokenElement(tokenData);
  upsertTokenState(tokenData);

  if (state.socket && state.currentSessionId) {
    state.socket.emit(state.SOCKET_EVENTS.ADD_TOKEN, tokenData);
  }
}

function createTokenElement(tokenData) {
  if (!elements.mapContainer) return;
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
  elements.mapContainer.appendChild(div);

  if (tokenData.id >= state.tokenIdCounter) {
    state.tokenIdCounter = Number(tokenData.id) + 1;
  }
}

function labelForType(type) {
  switch (type) {
    case 'pc':
      return 'PC';
    case 'monster':
      return 'M';
    case 'npc':
      return 'NPC';
    case 'prop-tree':
      return '🌳';
    case 'prop-rock':
      return '🪨';
    case 'building':
      return '🏠';
    default:
      return '?';
  }
}

function positionToken(el, col, row) {
  if (state.COLS == null || state.ROWS == null || state.CELL_SIZE == null) return;
  const clampedCol = Math.max(0, Math.min(state.COLS - 1, Number(col)));
  const clampedRow = Math.max(0, Math.min(state.ROWS - 1, Number(row)));
  el.style.left = `${clampedCol * state.CELL_SIZE + 2}px`;
  el.style.top = `${clampedRow * state.CELL_SIZE + 2}px`;
  el.dataset.col = clampedCol;
  el.dataset.row = clampedRow;
}

function onTokenClick(e) {
  e.stopPropagation();
  selectToken(e.currentTarget);
}

function selectToken(tokenEl) {
  if (state.selectedToken) {
    state.selectedToken.classList.remove('selected');
  }
  state.selectedToken = tokenEl;
  if (state.selectedToken) {
    state.selectedToken.classList.add('selected');
  }
}

function handleMapMouseDown(e) {
  if (e.target === elements.mapContainer || e.target.id === 'grid') {
    selectToken(null);
  }
}

function handleDeleteSelected() {
  if (!state.isGM) {
    alert('Only the Game Master can delete tokens');
    return;
  }
  if (!state.selectedToken) return;
  const tokenId = state.selectedToken.dataset.id;
  state.selectedToken.remove();
  state.selectedToken = null;
  removeTokenState(tokenId);

  if (state.socket && state.currentSessionId) {
    state.socket.emit(state.SOCKET_EVENTS.DELETE_TOKEN, { id: tokenId });
  }
}

function handleKeyDown(e) {
  if (e.key === 'Delete') {
    handleDeleteSelected();
  }
}

function onTokenMouseDown(e) {
  if (!state.isGM) return;
  e.preventDefault();
  state.draggingToken = e.currentTarget;
  state.draggingToken.classList.add('dragging');
  state.draggingToken.style.zIndex = '200';
  const rect = state.draggingToken.getBoundingClientRect();
  state.dragOffsetX = e.clientX - rect.left;
  state.dragOffsetY = e.clientY - rect.top;
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  if (!state.draggingToken || !elements.mapContainer) return;
  const rect = elements.mapContainer.getBoundingClientRect();
  let x = e.clientX - rect.left - state.dragOffsetX;
  let y = e.clientY - rect.top - state.dragOffsetY;
  const maxX = rect.width - state.draggingToken.offsetWidth;
  const maxY = rect.height - state.draggingToken.offsetHeight;
  x = Math.max(0, Math.min(maxX, x));
  y = Math.max(0, Math.min(maxY, y));
  state.draggingToken.style.left = `${x}px`;
  state.draggingToken.style.top = `${y}px`;
}

function onMouseUp() {
  if (!state.draggingToken || !elements.mapContainer || state.CELL_SIZE == null) return;
  const rect = elements.mapContainer.getBoundingClientRect();
  const tokenRect = state.draggingToken.getBoundingClientRect();
  const x = tokenRect.left - rect.left;
  const y = tokenRect.top - rect.top;
  const col = Math.round(x / state.CELL_SIZE);
  const row = Math.round(y / state.CELL_SIZE);
  positionToken(state.draggingToken, col, row);
  updateStoredTokenPosition(state.draggingToken.dataset.id, col, row);

  if (state.socket && state.currentSessionId) {
    state.socket.emit(state.SOCKET_EVENTS.MOVE_TOKEN, {
      id: state.draggingToken.dataset.id,
      col,
      row
    });
  }

  state.draggingToken.classList.remove('dragging');
  state.draggingToken.style.zIndex = 'auto';
  state.draggingToken = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  resetDraggingState();
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
  if (!state.currentSessionId || !token) return;
  const normalized = normalizeToken(token);
  tokenState.set(String(normalized.id), normalized);
  persistTokenState();
}

function updateStoredTokenPosition(tokenId, col, row) {
  if (!state.currentSessionId) return;
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
  if (!state.currentSessionId) return;
  tokenState.delete(String(tokenId));
  persistTokenState();
}

function persistTokenState() {
  if (!state.currentSessionId) return;
  persistTokens(state.currentSessionId, Array.from(tokenState.values()));
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

function clearBoardTokens() {
  if (!elements.mapContainer) return;
  const existingTokens = elements.mapContainer.querySelectorAll('.token');
  existingTokens.forEach((token) => token.remove());
  state.selectedToken = null;
  resetBoardState();
}
