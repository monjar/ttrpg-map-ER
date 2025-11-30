import { setSharedConstants } from './state.js';
import { showSessionModal } from './ui.js';
import { initTokenControls } from './tokens.js';
import {
  initSessionControls,
  bootstrapStoredSession,
  registerSessionExitHandler
} from './session.js';
import { initializeSocket } from './socket.js';

function initializeSharedConfig() {
  if (window.SHARED_CONSTANTS) {
    setSharedConstants(window.SHARED_CONSTANTS);
  } else {
    console.error('Shared constants not loaded! Check if /shared/constants.js is loading.');
  }
}

function initApp() {
  initializeSharedConfig();
  initTokenControls();
  initSessionControls();
  bootstrapStoredSession();
  showSessionModal();
  initializeSocket();
  registerSessionExitHandler(() => initializeSocket());
}

window.addEventListener('DOMContentLoaded', initApp);
