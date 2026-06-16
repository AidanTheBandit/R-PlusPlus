function setupMagicCamRoutes(app, connectedR1s) {
  // Magic Cam control endpoints - Device-specific

  app.post('/:deviceId/magic-cam/start', (req, res) => {
    try {
      const { deviceId } = req.params;
      const { facingMode = 'user' } = req.body;

      console.log(`Starting magic cam for device ${deviceId} with facing mode: ${facingMode}`);

      // Send camera start command to specific R1 device only
      const socket = connectedR1s.get(deviceId);
      if (!socket) {
        return res.status(404).json({ error: 'Device not connected' });
      }

      socket.emit('magic_cam_start', { facingMode });

      res.json({
        status: 'command_sent',
        command: 'start',
        facingMode,
        deviceId
      });
    } catch (error) {
      console.error('Error starting magic cam:', error);
      res.status(500).json({ error: 'Failed to start camera' });
    }
  });

  app.post('/:deviceId/magic-cam/stop', (req, res) => {
    try {
      const { deviceId } = req.params;

      console.log(`Stopping magic cam for device ${deviceId}`);

      // Send camera stop command to specific R1 device only
      const socket = connectedR1s.get(deviceId);
      if (!socket) {
        return res.status(404).json({ error: 'Device not connected' });
      }

      socket.emit('magic_cam_stop', {});

      res.json({
        status: 'command_sent',
        command: 'stop',
        deviceId
      });
    } catch (error) {
      console.error('Error stopping magic cam:', error);
      res.status(500).json({ error: 'Failed to stop camera' });
    }
  });

  app.post('/:deviceId/magic-cam/capture', (req, res) => {
    try {
      const { deviceId } = req.params;
      const { width = 240, height = 282 } = req.body;

      console.log(`Capturing photo for device ${deviceId} with dimensions: ${width}x${height}`);

      // Send photo capture command to specific R1 device only
      const socket = connectedR1s.get(deviceId);
      if (!socket) {
        return res.status(404).json({ error: 'Device not connected' });
      }

      socket.emit('magic_cam_capture', { width, height });

      res.json({
        status: 'command_sent',
        command: 'capture',
        dimensions: `${width}x${height}`,
        deviceId
      });
    } catch (error) {
      console.error('Error capturing photo:', error);
      res.status(500).json({ error: 'Failed to capture photo' });
    }
  });

  app.post('/:deviceId/magic-cam/switch', (req, res) => {
    try {
      const { deviceId } = req.params;

      console.log(`Switching magic cam for device ${deviceId}`);

      // Send camera switch command to specific R1 device only
      const socket = connectedR1s.get(deviceId);
      if (!socket) {
        return res.status(404).json({ error: 'Device not connected' });
      }

      socket.emit('magic_cam_switch', {});

      res.json({
        status: 'command_sent',
        command: 'switch',
        deviceId
      });
    } catch (error) {
      console.error('Error switching magic cam:', error);
      res.status(500).json({ error: 'Failed to switch camera' });
    }
  });

  app.get('/:deviceId/magic-cam/status', (req, res) => {
    try {
      const { deviceId } = req.params;

      const isConnected = connectedR1s.has(deviceId);

      res.json({
        deviceId,
        connected: isConnected,
        cameraCommands: ['start', 'stop', 'capture', 'switch'],
        supportedFacingModes: ['user', 'environment']
      });
    } catch (error) {
      console.error('Error getting magic cam status:', error);
      res.status(500).json({ error: 'Failed to get camera status' });
    }
  });
}

module.exports = { setupMagicCamRoutes };
