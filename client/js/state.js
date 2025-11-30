const mapContainer = document.getElementById('map-container');
const deleteBtn = document.getElementById('delete-selected');
const exitSessionBtn = document.getElementById('exit-session-btn');
const connectionStatus = document.getElementById('connection-status');
const sessionModal = document.getElementById('session-modal');
const gmBadge = document.getElementById('gm-badge');
const sessionInfo = document.getElementById('session-info');
const playerList = document.getElementById('player-list');

export const state = {
  CELL_SIZE: null,
  COLS: null,
  ROWS: null,
  SOCKET_EVENTS: null,
  tokenIdCounter: 1,
  selectedToken: null,
  draggingToken: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  pendingSessionData: null,
  currentDisplayName: '',
  socket: null,
  isConnected: false,
  isGM: false,
  currentSessionId: null
};

export const elements = {
  mapContainer,
  deleteBtn,
  exitSessionBtn,
  connectionStatus,
  sessionModal,
  gmBadge,
  sessionInfo,
  playerList
};

export function setSharedConstants(shared) {
  if (!shared) {
    console.error('Shared constants not provided.');
    return;
  }
  state.CELL_SIZE = shared.GRID_CONFIG.CELL_SIZE;
  state.COLS = shared.GRID_CONFIG.COLS;
  state.ROWS = shared.GRID_CONFIG.ROWS;
  state.SOCKET_EVENTS = shared.SOCKET_EVENTS;
}

export function resetDraggingState() {
  state.draggingToken = null;
  state.dragOffsetX = 0;
  state.dragOffsetY = 0;
}

export function resetBoardState() {
  state.tokenIdCounter = 1;
  state.selectedToken = null;
  resetDraggingState();
}
