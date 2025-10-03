# Technology Stack

## Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **WebSocket**: Socket.IO 4.x
- **Database**: SQLite3 with custom DatabaseManager
- **Authentication**: PIN-based system with Bearer tokens
- **Process Management**: PM2 for production

## Frontend Applications
- **Control Panel**: React 18 with Create React App
- **Creation Interface**: React 18 with Vite
- **UI Libraries**: Custom CSS with Gruvbox color scheme

## Key Dependencies
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `socket.io`: Real-time bidirectional communication
- `cors`: Cross-origin resource sharing
- `dotenv`: Environment variable management
- `sqlite3`: Database operations
- `ws`: WebSocket client support
- `zod`: Schema validation

## Build System

### Development Commands
```bash
# Start development server
npm run dev

# Start individual React apps in dev mode
npm run dev-creation        # Vite dev server
npm run dev-control-panel   # Create React App dev server
```

### Build Commands
```bash
# Build all React applications
npm run build-all

# Build individual applications
npm run build-creation      # Build Vite app
npm run build-control-panel # Build CRA app

# One-command setup (build + start)
npm run all
```

### Testing Commands
```bash
# Run all tests
npm test

# Run specific test suites
npm run test-unit           # Jest unit tests
npm run test-server         # Server integration tests
npm run test-mcp-*          # Various MCP-related tests
npm run test-virtual-r1     # Virtual R1 client tests
```

## Environment Configuration
- `PORT`: Server port (default: 5482)
- `DISABLE_PIN`: Disable PIN authentication (default: false)
- `OPENROUTER_API_KEY`: For virtual R1 testing

## Architecture Patterns
- **Modular routing**: Separate route files in `src/routes/`
- **Plugin system**: Extensible architecture via `plugins/`
- **Event-driven**: Socket.IO for real-time communication
- **Database abstraction**: Custom DatabaseManager class
- **Device management**: Persistent device IDs with DeviceIdManager