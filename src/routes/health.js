function setupHealthRoutes(app, connectedR1s) {
  // Health check endpoint
  app.get('/health', (req, res) => {
    console.log('💚 Health check called');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      connectedDevices: connectedR1s.size,
      server: 'R-API',
      version: '1.0.0'
    });
  });

  // Response endpoint for R1 devices to send responses via HTTP
  app.post('/response', (req, res) => {
    try {
      const { requestId, response, originalMessage, model, deviceId } = req.body;

      console.log(`HTTP Response from ${deviceId}:`, { requestId, response: response?.substring(0, 100) });

      // This endpoint is handled in the socket handler for consistency
      // For now, just acknowledge
      res.json({ status: 'response_received' });
    } catch (error) {
      console.error('Error processing HTTP response:', error);
      res.status(500).json({ error: 'Failed to process response' });
    }
  });

  // Error logging endpoint for R1 browser debugging
  app.post('/errors', (req, res) => {
    try {
      const { level, message, stack, url, userAgent, timestamp, deviceId } = req.body;

      console.log(`[R1 ERROR ${level.toUpperCase()}] ${deviceId || 'unknown'}: ${message}`);
      if (stack) {
        console.log(`Stack trace: ${stack}`);
      }
      console.log(`URL: ${url}, User-Agent: ${userAgent}, Time: ${timestamp}`);

      res.json({ status: 'logged' });
    } catch (error) {
      console.error('Error logging failed:', error);
      res.status(500).json({ error: 'Failed to log error' });
    }
  });
}

module.exports = { setupHealthRoutes };
