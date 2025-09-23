# R1 Control Panel

A modern React-based control panel for managing R1 devices and MCP servers.

## Features

- **💬 Chat Interface**: Test R1 devices with real-time messaging
- **🔌 MCP Server Management**: Add, configure, and monitor MCP servers
- **📱 Device Management**: View and manage connected R1 devices
- **🔧 Debug Tools**: Real-time debug data and system monitoring

## Development

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The development server will start on `http://localhost:3000` and proxy API requests to the R-API server on port 5482.

### Building for Production

```bash
# Build the React app
npm run build
```

The built files will be in the `build/` directory and can be served by the main R-API server.

## Components

### Header
- Displays server statistics
- Shows connected devices, API requests, and MCP server counts

### TabNavigation
- Switches between different interfaces
- Chat, MCP, Devices, and Debug tabs

### ChatInterface
- Real-time chat with R1 devices
- Device selection and message history
- WebSocket integration for live updates

### MCPManager
- Add and configure MCP servers using templates
- Monitor server status and tools
- View logs and manage server lifecycle

### DeviceManager
- View all connected R1 devices
- Test device connectivity
- Copy API URLs and view device information

### DebugTools
- Real-time debug data from R1 devices
- Filter by device and event type
- Export debug data for analysis

## API Integration

The control panel integrates with the R-API server through:

- REST API endpoints for CRUD operations
- WebSocket connections for real-time updates
- Proxy configuration for development

## Styling

- Modern CSS with CSS Grid and Flexbox
- Responsive design for mobile and desktop
- Consistent color scheme and typography
- Loading states and animations

## Deployment

The React app is built and served by the main R-API server. Run:

```bash
# From the main R-API directory
npm run build-control-panel
npm start
```

Then visit `http://localhost:5482` to access the control panel.