# TTRPG Battle Map - Real-Time Multiplayer

A lightweight, real-time battle map application for tabletop RPGs with multiplayer synchronization. The Game Master has full control over tokens while players can view the battle map in real-time.

## Features

### Current Features
- ✅ **Real-time synchronization** across all connected players
- ✅ **Game Master authority** - only the GM can add, move, or delete tokens
- ✅ **Session management** - create or join game sessions with unique IDs
- ✅ **Multiple token types**: Player Characters (PC), Monsters, NPCs
- ✅ **Environmental props**: Trees, Rocks, Buildings
- ✅ **Grid-based movement** with drag-and-drop for GM
- ✅ **Player list** showing all connected players
- ✅ **Connection status** indicator
- ✅ **Session persistence** during gameplay

### Planned Features
- 🔄 **Chat system** - in-game text chat for players and GM
- 🔄 **Dice roller** - integrated dice rolling with visible results
- 🔄 **Note taking** - personal notes for each player
- 🔄 **Character sheets** - NPC stat tracking for GM
- 🔄 **Token customization** - custom colors, names, and images
- 🔄 **Map backgrounds** - upload custom battle maps
- 🔄 **Fog of war** - reveal/hide areas of the map
- 🔄 **Measurement tools** - distance and area tools
- 🔄 **Save/Load** - save sessions and load them later
- 🔄 **Audio integration** - ambient music and sound effects

## Architecture

### Technology Stack
- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **No database** (currently in-memory, will add persistence later)

### Project Structure
```
ttrpg-map-ER/
├── server/
│   └── index.js        # Node.js server with Socket.IO
├── client/
│   ├── index.html      # Main HTML file
│   ├── script.js       # Client-side JavaScript
│   └── styles.css      # Styling
├── shared/
│   └── constants.js    # Shared constants between client/server
├── package.json        # Node dependencies and scripts
└── README.md           # This file
```

### How It Works

1. **Server (server.js)**
   - Manages game sessions in memory
   - Handles WebSocket connections via Socket.IO
   - Validates GM permissions before token operations
   - Broadcasts changes to all players in a session
   - Cleans up sessions when GM disconnects

2. **Client (script.js)**
   - Connects to server via Socket.IO
   - Creates/joins sessions with unique IDs
   - Sends token operations (add/move/delete) to server
   - Receives and renders updates from other players
   - Enforces GM-only controls in the UI

3. **Session Management**
   - Each game session has a unique ID (e.g., "game123")
   - First person to create a session becomes the GM
   - Other players can join with the session ID
   - Sessions are deleted when GM disconnects

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd /home/amirali/Projects/ttrpg-map-ER
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

### Running the Application

1. **Start the server**
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

2. **Open your browser**
   - Navigate to `http://localhost:3000`
   - The server will serve the HTML/CSS/JS files

3. **Create a game session (as GM)**
   - Enter a unique Session ID (e.g., "my-game-123")
   - Enter your name
   - Click "Create Session"
   - Share the Session ID with your players

4. **Join a game session (as Player)**
   - Get the Session ID from your GM
   - Enter the Session ID
   - Enter your name
   - Click "Join Session"

### Usage

#### As Game Master:
- **Add tokens**: Click buttons in the sidebar to add PCs, monsters, NPCs, or props
- **Move tokens**: Click and drag tokens to move them (snaps to grid)
- **Select tokens**: Click a token to select it (yellow outline)
- **Delete tokens**: Select a token and press `Delete` key or click "Delete Selected"
- **View players**: See all connected players in the sidebar

#### As Player:
- **View-only mode**: You can see all tokens and their movements
- **No editing**: Buttons are disabled, tokens cannot be moved
- **Track game**: Watch as the GM updates the battle map in real-time

## Configuration

### Change Server Port
Edit `server.js` or set environment variable:
```bash
PORT=8080 npm start
```

### Change Socket.IO URL (for deployment)
Edit `script.js` line 18:
```javascript
socket = io('http://your-server-url:3000');
```

## Deployment

### Local Network
1. Find your local IP address (e.g., `192.168.1.100`)
2. Start the server
3. Players connect to `http://192.168.1.100:3000`

### Cloud Deployment (Heroku, Railway, etc.)
1. Set up environment variables for PORT
2. Update Socket.IO connection URL in `script.js`
3. Deploy using your platform's instructions

### Docker (Future)
```dockerfile
# Dockerfile (to be created)
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Development Roadmap

### Phase 1 (Current) ✅
- Basic multiplayer synchronization
- GM authority system
- Token management
- Session creation/joining

### Phase 2 (Next)
- In-game chat system
- Dice rolling mechanics
- Token health/status indicators
- Initiative tracker

### Phase 3
- Character sheets for NPCs
- Personal note-taking for players
- Combat log/history
- Token customization (colors, names)

### Phase 4
- Map backgrounds and custom images
- Fog of war
- Drawing tools (lines, shapes)
- Measurement tools

### Phase 5
- Database integration (MongoDB/PostgreSQL)
- Session save/load functionality
- User accounts and authentication
- Campaign management

## API Documentation

### Socket.IO Events

#### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `create-session` | `{sessionId, gmName}` | Create new game session as GM |
| `join-session` | `{sessionId, playerName}` | Join existing session as player |
| `add-token` | `{id, type, col, row, label}` | Add token (GM only) |
| `move-token` | `{id, col, row}` | Move token (GM only) |
| `delete-token` | `{id}` | Delete token (GM only) |
| `list-sessions` | - | Get list of active sessions |

#### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `session-created` | `{sessionId, isGM, players, tokens}` | Confirm session creation |
| `session-joined` | `{sessionId, isGM, players, tokens}` | Confirm session join |
| `token-added` | `{id, type, col, row, label}` | Token added by GM |
| `token-moved` | `{id, col, row}` | Token moved by GM |
| `token-deleted` | `{id}` | Token deleted by GM |
| `player-joined` | `{playerName, players}` | New player joined |
| `player-left` | `{playerName, players}` | Player left |
| `gm-disconnected` | `{message}` | GM disconnected, session closing |
| `permission-denied` | `{message}` | Action not allowed for non-GM |
| `session-error` | `{message}` | Session operation error |

## Troubleshooting

### Cannot connect to server
- Check if server is running (`npm start`)
- Verify the port is correct (default: 3000)
- Check firewall settings
- Make sure Socket.IO script loads (check browser console)

### Players not seeing updates
- Verify all players are in the same session ID
- Check browser console for errors
- Refresh the page and rejoin

### GM cannot move tokens
- Ensure you created the session (not joined it)
- Check for the "⚔️ Game Master" badge in sidebar
- Refresh and create a new session if needed

## Contributing

This is a personal project, but suggestions and improvements are welcome! Future plans include:
- More token types and customization
- Advanced map features
- Mobile responsiveness
- Voice chat integration

## License

MIT License - Feel free to use and modify for your own games!

## Credits

Built for tabletop RPG enthusiasts who want a simple, fast battle map without the bloat of complex VTT software.

---

**Happy Gaming! 🎲⚔️🐉**
