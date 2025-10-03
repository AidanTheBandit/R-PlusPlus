# Project Structure

## Root Directory
```
├── src/                    # Main backend source code
├── creation-react/         # Vite-based React interface
├── r1-control-panel/       # CRA-based control panel
├── public/                 # Static assets fallback
├── plugins/                # Plugin system modules
├── scripts/                # Testing and utility scripts
├── docs/                   # Documentation files
├── examples/               # Usage examples
└── .kiro/                  # Kiro IDE configuration
```

## Backend Structure (`src/`)
```
src/
├── routes/                 # Express route modules
│   ├── openai.js          # OpenAI-compatible API endpoints
│   ├── mcp.js             # Model Context Protocol routes
│   ├── magic-cam.js       # Camera control endpoints
│   ├── health.js          # Health monitoring
│   ├── debug.js           # Debug and analytics
│   ├── twilio.js          # Twilio integration
│   └── audio.js           # Audio/TTS endpoints
├── socket/                 # WebSocket handling
│   └── socket-handler.js  # Main socket event management
├── utils/                  # Utility modules
│   ├── database.js        # SQLite database manager
│   ├── device-id-manager.js # Device identification
│   ├── mcp-manager.js     # MCP protocol management
│   ├── mcp-protocol-client.js # MCP client implementation
│   ├── r-api-client.js    # R1 API client
│   └── response-utils.js  # Response formatting
├── tests/                  # Unit tests
└── server.js              # Main server entry point
```

## Frontend Applications

### Control Panel (`r1-control-panel/`)
- **Build System**: Create React App
- **Purpose**: Main device management interface
- **Components**: Device login, MCP management, chat interface, logs

### Creation Interface (`creation-react/`)
- **Build System**: Vite
- **Purpose**: R1 device testing and interaction
- **Components**: Console panel, device info, status monitoring

## Key Files
- `package.json`: Main project dependencies and scripts
- `ecosystem.config.js`: PM2 process management
- `jest.config.js`: Jest testing configuration
- `virtual-r1.js`: Virtual R1 client for testing
- `r-api.db`: SQLite database file

## Naming Conventions
- **Device IDs**: `{adjective}-{noun}-{number}` format (e.g., `red-fox-42`)
- **API Routes**: Device-specific endpoints use `/device-{deviceId}/` prefix
- **File Names**: Kebab-case for files, PascalCase for React components
- **Database Tables**: Snake_case for columns, camelCase for JavaScript objects

## Plugin System
- **Location**: `plugins/` directory
- **Structure**: Each plugin exports `name`, `version`, `description`, and `init` function
- **Loading**: Automatic discovery and initialization via PluginManager

## Documentation Structure
```
docs/
├── api.md                 # API reference (planned)
├── backend.md             # Backend architecture details
├── mcp.md                 # MCP integration guide
└── plugins.md             # Plugin development guide
```