# R-API Gen 2 Roadmap

## Overview
Gen 2 introduces a complete UI overhaul with shadcn/ui components, a new default docked mode, live-updating widgets, voice control capabilities, and enhanced device management features.

**Critical Architecture Note**: Voice features must be implemented via backend processing due to R1's Android AOSP WebView limitations (no speech recognition support).

## Research Findings

### Current System Analysis
- **Frontend**: Two React applications (r1-control-panel for remote control, creation-react for device-side interface)
- **UI Framework**: Plain React with custom CSS, no component library
- **Backend**: Node.js/Express with Socket.IO, MCP integration
- **Features**: Chat interface, phone linking, MCP server management, device authentication

### Key Technologies for Gen 2

#### UI Framework: shadcn/ui
- **Description**: Modern component library built on Radix UI primitives and Tailwind CSS
- **Benefits**: Accessible, customizable, consistent design system
- **Integration**: CLI tool that adds components to existing React projects
- **Requirements**: Tailwind CSS setup, proper theming configuration
- **Current Status**: Not implemented in either frontend

#### Voice Recognition
- **Web Speech API**: ❌ NOT VIABLE - R1 uses Android AOSP WebView which lacks speech recognition
- **Alternative Approaches**:
  - Backend audio processing via WebSocket audio streaming
  - Native Android voice integration on R1 device
  - Cloud speech services (Azure Speech, Google Speech-to-Text)
  - Hardware-accelerated voice processing on device
- **Wake Word Detection**: Must be implemented at device level or backend
- **Architecture**: Audio capture → stream to backend → cloud processing → command execution
- **Privacy**: Local processing preferred, but cloud fallback required for accuracy

#### Widget System
- **Architecture**: Plugin-based widget framework with dev API and custom JavaScript support
- **Live Updates**: WebSocket integration for real-time data
- **Types**: Charts, graphs, feeds, status indicators, custom widgets with uploaded JS
- **Configuration**: JSON-based config with drag-and-drop positioning
- **Dev API**: REST endpoints for widget registration and data feeds
- **Custom Code**: Secure JavaScript upload with sandboxing and validation

#### Docked Mode
- **Features**: Compact view, gesture navigation, voice triggers

### Technical Requirements

#### Dependencies to Add
- `tailwindcss`, `@tailwindcss/typography`, `autoprefixer`
- `@radix-ui/*` components (dialogs, dropdowns, etc.)
- `lucide-react` for icons
- `recharts` or `chart.js` for data visualization
- Voice: `microsoft-cognitiveservices-speech-sdk` or `google-cloud/speech` for backend processing
- Audio: `socket.io-stream` or WebRTC for audio streaming
- Security: `vm2` or `isolated-vm` for JavaScript sandboxing

#### Architecture Changes
- Component library migration
- Widget registry system
- Voice processing pipeline (backend/cloud-based, not browser)
- Docked mode state management
- Real-time data subscriptions
- Audio streaming infrastructure
- JavaScript sandboxing environment for custom widgets

## Implementation Checklist

### Phase 1: Foundation Setup
- [ ] Research and document shadcn/ui integration process
- [ ] Set up Tailwind CSS in both React applications
- [ ] Create shadcn/ui configuration and theme
- [ ] Migrate basic components (buttons, inputs, cards) to shadcn
- [ ] Update component imports and styling

### Phase 2: Docked Mode Infrastructure
- [ ] Design docked mode UI layout and interactions
- [ ] Implement gesture recognition (swipe right-to-left)
- [ ] Create stats panel component (device ID, PIN, activity log)
- [ ] Add docked mode toggle in control panel (user-activated)
- [ ] Implement overlay positioning and z-index management

### Phase 3: Widget System
- [ ] Design widget architecture and API
- [ ] Create widget registry and configuration system
- [ ] Implement core widget types (charts, graphs, feeds)
- [ ] Add live update mechanisms via WebSocket
- [ ] Create widget management UI in control panel
- [ ] Develop dev API for custom widgets
- [ ] Implement JavaScript upload with code validation and sandboxing
- [ ] Add security measures (code cleansing, execution isolation)
- [ ] Create JavaScript execution environment for custom widgets

### Phase 4: Voice Features (Backend-Focused)
- [ ] Design audio streaming architecture (WebSocket/WebRTC)
- [ ] Implement backend voice processing pipeline
- [ ] Add cloud speech service integration (Azure/Google)
- [ ] Create wake word detection at device/backend level
- [ ] Implement audio capture permissions and controls
- [ ] Develop voice command routing to existing chat/API system
- [ ] Test voice recognition accuracy with cloud processing

### Phase 5: UI Polish and Integration
- [ ] Complete shadcn/ui component migration
- [ ] Implement responsive design for docked mode
- [ ] Add smooth animations and transitions
- [ ] Create comprehensive theming system
- [ ] Test cross-browser compatibility

### Phase 6: Testing and Deployment
- [ ] Unit tests for new components and features
- [ ] Integration tests for voice and widget systems
- [ ] Performance testing for live updates
- [ ] User acceptance testing
- [ ] Documentation updates
- [ ] Deployment preparation

## Technical Challenges

### High Priority
1. **Voice Recognition Architecture**: Backend/cloud processing instead of browser-based
2. **Audio Streaming Performance**: Low-latency audio transport on constrained device
3. **Widget Security**: Safe execution of user-uploaded JavaScript code
4. **Widget Performance**: Managing real-time updates without UI lag on limited hardware
5. **Docked Mode Positioning**: Cross-platform overlay implementation
6. **Component Migration**: Maintaining functionality during shadcn transition

### Medium Priority
1. **Network Dependency**: Voice features require backend connectivity
2. **Widget Customization**: Balancing flexibility with performance on limited device
3. **State Management**: Coordinating between docked and full modes

### Low Priority
1. **Offline Functionality**: Basic wake word detection without backend
2. **Accessibility**: Screen reader support for voice features
3. **Internationalization**: Multi-language voice commands
4. **Audio Quality**: Noise cancellation and echo reduction

## Success Metrics

### Functional Requirements
- [ ] Docked mode can be activated by user from control panel
- [ ] Swipe gesture reliably shows stats panel
- [ ] Voice commands trigger within 1 second of wake word (accounting for network latency)
- [ ] Widgets update in real-time with <100ms latency
- [ ] Dev API supports third-party widget development
- [ ] Custom JavaScript widgets can be securely uploaded and executed
- [ ] Voice processing works offline-capable with local wake word detection

### Quality Requirements
- [ ] UI loads within 2 seconds on device
- [ ] Voice recognition accuracy >90% in quiet environments
- [ ] Zero crashes during normal operation
- [ ] Full accessibility compliance (WCAG 2.1 AA)

### User Experience
- [ ] Intuitive gesture navigation
- [ ] Clear visual feedback for voice commands
- [ ] Customizable widget layouts
- [ ] Seamless mode switching

## Risk Assessment

### R1 Device Constraints
- **WebView Limitations**: Android AOSP WebView lacks advanced APIs (speech recognition, advanced media)
- **Hardware Constraints**: Limited processing power, battery, and memory
- **Network Dependency**: Many features require backend connectivity
- **Platform Restrictions**: Cannot rely on modern browser features
- **Dock Detection**: No API available to detect physical docking state

### Technical Risks
- **Voice Architecture Overhaul**: Complete redesign from browser to backend processing
- **Network Reliability**: Voice features depend on stable connectivity
- **Widget Security**: Safe execution of user-uploaded JavaScript without compromising system
- **Security**: Audio data transmission requires careful encryption and privacy handling

### Timeline Risks
- **Component Migration**: Large-scale UI changes may introduce bugs
- **Third-party Dependencies**: shadcn/ui and voice libraries may have breaking changes
- **Testing Complexity**: Voice features difficult to automate

### Mitigation Strategies
- **Incremental Migration**: Migrate components in phases with thorough testing
- **Fallback Systems**: Implement degraded modes when features unavailable
- **Progressive Enhancement**: Core functionality works without advanced features
- **User Testing**: Early beta testing for voice and gesture features

## Next Steps

1. **Immediate**: Begin shadcn/ui setup and basic component migration
2. **Week 1**: Complete foundation setup and start docked mode prototype
3. **Week 2**: Implement widget system core and voice recognition basics
4. **Week 3**: Integration testing and UI polish
5. **Week 4**: Beta testing and documentation

## Resources Needed

### Development
- React/TypeScript expertise for component development
- UI/UX designer for docked mode and widget layouts
- Audio processing knowledge for voice features
- Security expertise for JavaScript sandboxing and code validation

### Testing
- Various devices for cross-platform testing
- Microphone testing in different environments
- Performance monitoring tools
- Widget JavaScript security and sandboxing validation

### Documentation
- API documentation for widget dev kit
- User guides for new features
- Migration guides for existing integrations</content>
<parameter name="filePath">/Users/aidanpds/Documents/Boondit/R-API/plan.md