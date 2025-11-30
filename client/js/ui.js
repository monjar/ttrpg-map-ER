import { elements, state } from './state.js';
import { loadStoredSession } from './storage.js';

export function updateConnectionStatus(connected) {
  if (!elements.connectionStatus) return;
  elements.connectionStatus.textContent = connected ? '● Connected' : '○ Disconnected';
  elements.connectionStatus.style.color = connected ? '#4caf50' : '#f44336';
}

export function updatePlayerList(players = []) {
  if (!elements.playerList) return;
  elements.playerList.innerHTML = players.map(
    (player) => `<div class="player-item">${player.name} ${player.isGM ? '(GM)' : ''}</div>`
  ).join('');
}

export function updateGMControls() {
  const addButtons = document.querySelectorAll('[data-add-token]');
  addButtons.forEach((btn) => {
    btn.disabled = !state.isGM;
    btn.style.opacity = state.isGM ? '1' : '0.5';
  });

  if (elements.gmBadge) {
    elements.gmBadge.style.display = state.isGM ? 'block' : 'none';
  }

  if (elements.sessionInfo) {
    const storedSession = loadStoredSession();
    const sessionIdToShow = state.currentSessionId || storedSession?.sessionId;
    if (sessionIdToShow) {
      elements.sessionInfo.innerHTML = `
        <strong>Session ID:</strong> ${sessionIdToShow}<br/>
        <strong>Role:</strong> ${state.isGM ? 'Game Master' : 'Player'}
      `;
    } else {
      elements.sessionInfo.innerHTML = '';
    }
  }

  setExitButtonState(Boolean(state.currentSessionId || loadStoredSession()?.sessionId));
}

export function setExitButtonState(enabled) {
  if (!elements.exitSessionBtn) return;
  elements.exitSessionBtn.disabled = !enabled;
  elements.exitSessionBtn.style.visibility = enabled ? 'visible' : 'hidden';
}

export function showNotification(message) {
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

export function hideSessionModal() {
  if (!elements.sessionModal) return;
  elements.sessionModal.style.display = 'none';
}

export function showSessionModal() {
  if (!elements.sessionModal) return;
  prefillSessionModal();
  elements.sessionModal.style.display = 'flex';
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
