function setupMagicCamRoutes(app, connectedR1s) {
  // Magic Cam control endpoints

  app.post('/magic-cam/start', (req, res) => {
    try {
      const { facingMode = 'user' } = req.body;

      console.log(`Starting magic cam with facing mode: ${facingMode}`);

      // Broadcast camera start command to all R1 devices
      connectedR1s.forEach((socket, deviceId) => {
        socket.emit('magic_cam_start', { facingMode });
      });

      res.json({
        status: 'command_sent',
        command: 'start',
        facingMode,
        devices: connectedR1s.size
      });
    } catch (error) {
      console.error('Error starting magic cam:', error);
      res.status(500).json({ error: 'Failed to start camera' });
    }
  });

  app.post('/magic-cam/stop', (req, res) => {
    try {
      console.log('Stopping magic cam');

      // Broadcast camera stop command to all R1 devices
      connectedR1s.forEach((socket, deviceId) => {
        socket.emit('magic_cam_stop', {});
      });

      res.json({
        status: 'command_sent',
        command: 'stop',
        devices: connectedR1s.size
      });
    } catch (error) {
      console.error('Error stopping magic cam:', error);
      res.status(500).json({ error: 'Failed to stop camera' });
    }
  });

  app.post('/magic-cam/capture', (req, res) => {
    try {
      const { width = 240, height = 282 } = req.body;

      console.log(`Capturing photo with dimensions: ${width}x${height}`);

      // Broadcast photo capture command to all R1 devices
      connectedR1s.forEach((socket, deviceId) => {
        socket.emit('magic_cam_capture', { width, height });
      });

      res.json({
        status: 'command_sent',
        command: 'capture',
        dimensions: `${width}x${height}`,
        devices: connectedR1s.size
      });
    } catch (error) {
      console.error('Error capturing photo:', error);
      res.status(500).json({ error: 'Failed to capture photo' });
    }
  });

  app.post('/magic-cam/switch', (req, res) => {
    try {
      console.log('Switching magic cam');

      // Broadcast camera switch command to all R1 devices
      connectedR1s.forEach((socket, deviceId) => {
        socket.emit('magic_cam_switch', {});
      });

      res.json({
        status: 'command_sent',
        command: 'switch',
        devices: connectedR1s.size
      });
    } catch (error) {
      console.error('Error switching magic cam:', error);
      res.status(500).json({ error: 'Failed to switch camera' });
    }
  });

  app.get('/magic-cam/status', (req, res) => {
    try {
      res.json({
        connectedDevices: connectedR1s.size,
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
