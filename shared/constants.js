/**
 * Shared constants between client and server
 * Wrapped in an IIFE to avoid leaking const bindings in the browser global scope.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SHARED_CONSTANTS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Grid configuration
  const GRID_CONFIG = {
    CELL_SIZE: 40,
    COLS: 20,
    ROWS: 20
  };

  // Token types
  const TOKEN_TYPES = {
    PC: 'pc',
    MONSTER: 'monster',
    NPC: 'npc',
    PROP_TREE: 'prop-tree',
    PROP_ROCK: 'prop-rock',
    BUILDING: 'building'
  };

  // Socket.IO events
  const SOCKET_EVENTS = {
    // Client to Server
    CREATE_SESSION: 'create-session',
    JOIN_SESSION: 'join-session',
    ADD_TOKEN: 'add-token',
    MOVE_TOKEN: 'move-token',
    DELETE_TOKEN: 'delete-token',
    LIST_SESSIONS: 'list-sessions',
    
    // Server to Client
    SESSION_CREATED: 'session-created',
    SESSION_JOINED: 'session-joined',
    SESSION_ERROR: 'session-error',
    TOKEN_ADDED: 'token-added',
    TOKEN_MOVED: 'token-moved',
    TOKEN_DELETED: 'token-deleted',
    PLAYER_JOINED: 'player-joined',
    PLAYER_LEFT: 'player-left',
    GM_DISCONNECTED: 'gm-disconnected',
    PERMISSION_DENIED: 'permission-denied',
    SESSIONS_LIST: 'sessions-list'
  };

  return {
    GRID_CONFIG,
    TOKEN_TYPES,
    SOCKET_EVENTS
  };
});
