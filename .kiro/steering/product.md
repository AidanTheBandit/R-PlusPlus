# Product Overview

R-API is a bridge interface that enables remote control and communication with R1 devices through WebSocket and REST API endpoints.

## Core Purpose
- Provides OpenAI-compatible REST API endpoints for sending commands to R1 devices
- Enables real-time bidirectional communication via WebSocket server
- Supports multi-device management with unique device identification
- Integrates Model Context Protocol (MCP) for extensible tool support

## Key Features
- OpenAI-compatible API (`/v1/chat/completions`, `/v1/models`)
- WebSocket server for real-time R1 communication
- Multi-device support with persistent device IDs
- PIN-based authentication system
- Plugin architecture for extensibility
- MCP integration for tool management
- React-based control panels and interfaces
- Camera control and media handling
- Comprehensive logging and debugging tools

## Target Users
- Developers building applications that interact with R1 devices
- Users wanting remote control of their R1 devices
- Teams needing multi-device R1 management
- Developers extending functionality through plugins or MCP tools