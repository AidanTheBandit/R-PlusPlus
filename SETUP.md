# R-API Setup Guide

## Quick Start (Recommended)

The fastest way to get R-API running with all features:

```bash
# Clone the repository
git clone <repository-url>
cd R-API

# Install dependencies and build everything
npm install
npm run all
```

This single command will:
1. Install main server dependencies
2. Install and build the Creation React UI
3. Install and build the R1 Control Panel
4. Start the R-API server

Then visit `http://localhost:5482` for the full control panel.

## Manual Setup

If you prefer to build components individually:

### 1. Install Main Dependencies
```bash
npm install
```

### 2. Build React UIs

#### Build Control Panel (Main UI)
```bash
npm run build-control-panel
```

#### Build Creation React (R1 Device UI)
```bash
npm run build-creation
```

#### Build Both
```bash
npm run build-all
```

### 3. Start Server
```bash
npm start
```

## Development Mode

### Server Development
```bash
npm run dev
```

### React Control Panel Development
```bash
npm run dev-control-panel
```
This starts the React dev server on `http://localhost:3000` with hot reload.

### Creation React Development
```bash
npm run dev-creation
```
This starts the Creation React dev server.

## Verification

### Check Builds
```bash
npm run check-builds
```

### Test Device ID Blacklist
```bash
npm run test-blacklist
```

### Run All Tests
```bash
npm test
```

## File Structure

```
R-API/
├── src/                          # Main server code
│   ├── routes/                   # API routes
│   ├── utils/                    # Utilities (MCP, database, etc.)
│   └── server.js                 # Main server file
├── r1-control-panel/             # React control panel
│   ├── src/components/           # React components
│   ├── build/                    # Built files (served at /)
│   └── package.json
├── creation-react/               # R1 device interface
│   ├── src/                      # React source
│   ├── dist/                     # Built files (served at /creation)
│   └── package.json
├── public/                       # Static fallback files
├── docs/                         # Documentation
├── scripts/                      # Utility scripts
└── package.json                  # Main package file
```

## URLs

After running `npm run all`:

- **Main Control Panel**: `http://localhost:5482/`
- **MCP Management**: `http://localhost:5482/` (MCP Servers tab)
- **Creation React**: `http://localhost:5482/creation`
- **API Endpoints**: `http://localhost:5482/{device-id}/v1/chat/completions`
- **WebSocket**: `ws://localhost:5482/socket.io`

## Environment Variables

- `PORT`: Server port (default: 5482)
- `DISABLE_PIN`: Set to `true` to disable PIN authentication

## Troubleshooting

### Build Issues

If builds fail:
```bash
# Clean and rebuild
rm -rf r1-control-panel/build
rm -rf r1-control-panel/node_modules
rm -rf creation-react/dist
rm -rf creation-react/node_modules

# Rebuild
npm run build-all
```

### Port Issues

If port 5482 is in use:
```bash
PORT=3001 npm start
```

### Missing Dependencies

If you get dependency errors:
```bash
# Reinstall all dependencies
npm install
cd r1-control-panel && npm install && cd ..
cd creation-react && npm install && cd ..
```

### Database Issues

If database errors occur:
```bash
# Remove database file to reset
rm r-api.db
npm start
```

## Production Deployment

### Build for Production
```bash
npm run build-all
```

### Start Production Server
```bash
NODE_ENV=production npm start
```

### Using PM2
```bash
npm install -g pm2
pm2 start src/server.js --name "r-api"
```

### Docker (Optional)
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build-all
EXPOSE 5482
CMD ["npm", "start"]
```

## Security Notes

- Device IDs like `red-fox-42` are blacklisted to prevent confusion with documentation examples
- PIN codes are generated automatically for device authentication
- MCP servers run in isolated processes
- All API endpoints support CORS for development

## Support

- Check the main [README.md](README.md) for API documentation
- See [docs/mcp.md](docs/mcp.md) for MCP setup details
- Run `npm run check-builds` to verify setup
- Run `npm test` to verify functionality