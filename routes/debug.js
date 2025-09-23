// Debug routes

function setupDebugRoutes(app, connectedR1s, debugStreams, deviceLogs, debugDataStore, performanceMetrics) {
  // Debug data collection endpoints

  // Hardware events endpoint
  app.post('/debug/hardware-event', (req, res) => {
    try {
      const { deviceId, event } = req.body;

      if (!deviceId || !event) {
        return res.status(400).json({ error: 'Missing deviceId or event data' });
      }

      // Store hardware event
      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.hardware.push({
        ...event,
        serverTimestamp: new Date().toISOString()
      });

      // Keep only last 100 hardware events per device
      if (deviceData.hardware.length > 100) {
        deviceData.hardware = deviceData.hardware.slice(-100);
      }

      console.log(`Hardware event from ${deviceId}: ${event.type}`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing hardware event:', error);
      res.status(500).json({ error: 'Failed to store hardware event' });
    }
  });

  // Camera events endpoint
  app.post('/debug/camera-event', (req, res) => {
    try {
      const { deviceId, event } = req.body;

      if (!deviceId || !event) {
        return res.status(400).json({ error: 'Missing deviceId or event data' });
      }

      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.camera.push({
        ...event,
        serverTimestamp: new Date().toISOString()
      });

      if (deviceData.camera.length > 50) {
        deviceData.camera = deviceData.camera.slice(-50);
      }

      console.log(`Camera event from ${deviceId}: ${event.type}`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing camera event:', error);
      res.status(500).json({ error: 'Failed to store camera event' });
    }
  });

  // LLM events endpoint
  app.post('/debug/llm-event', (req, res) => {
    try {
      const { deviceId, event } = req.body;

      if (!deviceId || !event) {
        return res.status(400).json({ error: 'Missing deviceId or event data' });
      }

      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.llm.push({
        ...event,
        serverTimestamp: new Date().toISOString()
      });

      if (deviceData.llm.length > 50) {
        deviceData.llm = deviceData.llm.slice(-50);
      }

      console.log(`LLM event from ${deviceId}: ${event.type}`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing LLM event:', error);
      res.status(500).json({ error: 'Failed to store LLM event' });
    }
  });

  // Storage events endpoint
  app.post('/debug/storage-event', (req, res) => {
    try {
      const { deviceId, event } = req.body;

      if (!deviceId || !event) {
        return res.status(400).json({ error: 'Missing deviceId or event data' });
      }

      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.storage.push({
        ...event,
        serverTimestamp: new Date().toISOString()
      });

      if (deviceData.storage.length > 50) {
        deviceData.storage = deviceData.storage.slice(-50);
      }

      console.log(`Storage event from ${deviceId}: ${event.type}`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing storage event:', error);
      res.status(500).json({ error: 'Failed to store storage event' });
    }
  });

  // Audio events endpoint
  app.post('/debug/audio-event', (req, res) => {
    try {
      const { deviceId, event } = req.body;

      if (!deviceId || !event) {
        return res.status(400).json({ error: 'Missing deviceId or event data' });
      }

      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.audio.push({
        ...event,
        serverTimestamp: new Date().toISOString()
      });

      if (deviceData.audio.length > 50) {
        deviceData.audio = deviceData.audio.slice(-50);
      }

      console.log(`Audio event from ${deviceId}: ${event.type}`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing audio event:', error);
      res.status(500).json({ error: 'Failed to store audio event' });
    }
  });

  // Performance events endpoint
  app.post('/debug/performance-event', (req, res) => {
    try {
      const { deviceId, event } = req.body;

      if (!deviceId || !event) {
        return res.status(400).json({ error: 'Missing deviceId or event data' });
      }

      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.performance.push({
        ...event,
        serverTimestamp: new Date().toISOString()
      });

      if (deviceData.performance.length > 50) {
        deviceData.performance = deviceData.performance.slice(-50);
      }

      console.log(`Performance event from ${deviceId}: ${event.type}`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing performance event:', error);
      res.status(500).json({ error: 'Failed to store performance event' });
    }
  });

  // Device info endpoint
  app.post('/debug/device-event', (req, res) => {
    try {
      const { deviceId, event } = req.body;

      if (!deviceId || !event) {
        return res.status(400).json({ error: 'Missing deviceId or event data' });
      }

      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.device.push({
        ...event,
        serverTimestamp: new Date().toISOString()
      });

      if (deviceData.device.length > 20) {
        deviceData.device = deviceData.device.slice(-20);
      }

      console.log(`Device event from ${deviceId}: ${event.type}`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing device event:', error);
      res.status(500).json({ error: 'Failed to store device event' });
    }
  });

  // Client logs endpoint
  app.post('/debug/client-log', (req, res) => {
    try {
      const { deviceId, log } = req.body;

      if (!deviceId || !log) {
        return res.status(400).json({ error: 'Missing deviceId or log data' });
      }

      if (!deviceLogs.has(deviceId)) {
        deviceLogs.set(deviceId, []);
      }

      const logs = deviceLogs.get(deviceId);
      logs.push({
        ...log,
        serverTimestamp: new Date().toISOString()
      });

      // Keep only last 500 logs per device
      if (logs.length > 500) {
        logs.splice(0, logs.length - 500);
      }

      console.log(`Client log from ${deviceId}: [${log.level}] ${log.message.substring(0, 50)}...`);
      res.json({ status: 'logged' });
    } catch (error) {
      console.error('Error storing client log:', error);
      res.status(500).json({ error: 'Failed to store client log' });
    }
  });

  // Get debug data endpoint
  app.get('/debug/data/:deviceId', (req, res) => {
    try {
      const { deviceId } = req.params;
      const data = debugDataStore.get(deviceId) || { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] };

      res.json({
        deviceId,
        data,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error retrieving debug data:', error);
      res.status(500).json({ error: 'Failed to retrieve debug data' });
    }
  });

  // Get device logs endpoint
  app.get('/debug/logs/:deviceId', (req, res) => {
    try {
      const { deviceId } = req.params;
      const logs = deviceLogs.get(deviceId) || [];

      res.json({
        deviceId,
        logs,
        count: logs.length,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error retrieving device logs:', error);
      res.status(500).json({ error: 'Failed to retrieve device logs' });
    }
  });

  // Get all connected devices debug summary
  app.get('/debug/devices', (req, res) => {
    try {
      const devices = Array.from(connectedR1s.keys()).map(deviceId => {
        const data = debugDataStore.get(deviceId);
        const logs = deviceLogs.get(deviceId);

        return {
          deviceId,
          connected: true,
          dataPoints: data ? {
            hardware: data.hardware.length,
            camera: data.camera.length,
            llm: data.llm.length,
            storage: data.storage.length,
            audio: data.audio.length,
            performance: data.performance.length,
            device: data.device.length
          } : { hardware: 0, camera: 0, llm: 0, storage: 0, audio: 0, performance: 0, device: 0 },
          logCount: logs ? logs.length : 0,
          lastActivity: data ? Math.max(
            ...data.hardware.map(d => new Date(d.serverTimestamp)),
            ...data.camera.map(d => new Date(d.serverTimestamp)),
            ...data.llm.map(d => new Date(d.serverTimestamp)),
            ...data.storage.map(d => new Date(d.serverTimestamp)),
            ...data.audio.map(d => new Date(d.serverTimestamp)),
            ...data.performance.map(d => new Date(d.serverTimestamp)),
            ...data.device.map(d => new Date(d.serverTimestamp))
          ) : null
        };
      });

      res.json({
        devices,
        totalDevices: devices.length,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error retrieving devices summary:', error);
      res.status(500).json({ error: 'Failed to retrieve devices summary' });
    }
  });

  // Clear debug data endpoint
  app.post('/debug/clear/:deviceId', (req, res) => {
    try {
      const { deviceId } = req.params;

      debugDataStore.delete(deviceId);
      deviceLogs.delete(deviceId);

      console.log(`Cleared debug data for device: ${deviceId}`);
      res.json({ status: 'cleared', deviceId });
    } catch (error) {
      console.error('Error clearing debug data:', error);
      res.status(500).json({ error: 'Failed to clear debug data' });
    }
  });

  // System info endpoint
  app.post('/debug/system-info', (req, res) => {
    try {
      const { deviceId, systemInfo } = req.body;

      if (!deviceId || !systemInfo) {
        return res.status(400).json({ error: 'Missing deviceId or systemInfo' });
      }

      // Store system info in performance metrics
      if (!performanceMetrics.has(deviceId)) {
        performanceMetrics.set(deviceId, []);
      }

      const metrics = performanceMetrics.get(deviceId);
      metrics.push({
        type: 'system_info',
        data: systemInfo,
        timestamp: new Date().toISOString()
      });

      // Keep only last 10 system info entries
      if (metrics.length > 10) {
        metrics.splice(0, metrics.length - 10);
      }

      console.log(`System info received from ${deviceId}`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing system info:', error);
      res.status(500).json({ error: 'Failed to store system info' });
    }
  });

  // Photo capture endpoint
  app.post('/debug/photo-captured', (req, res) => {
    try {
      const { deviceId, photo, timestamp } = req.body;

      if (!deviceId || !photo) {
        return res.status(400).json({ error: 'Missing deviceId or photo data' });
      }

      // Store photo info in camera data
      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.camera.push({
        type: 'photo_captured',
        photoSize: photo.length,
        timestamp: timestamp || new Date().toISOString(),
        serverTimestamp: new Date().toISOString()
      });

      if (deviceData.camera.length > 20) {
        deviceData.camera = deviceData.camera.slice(-20);
      }

      console.log(`Photo captured from ${deviceId}, size: ${photo.length} bytes`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing photo data:', error);
      res.status(500).json({ error: 'Failed to store photo data' });
    }
  });

  // Audio capture endpoint
  app.post('/debug/audio-captured', (req, res) => {
    try {
      const { deviceId, audio, timestamp } = req.body;

      if (!deviceId || !audio) {
        return res.status(400).json({ error: 'Missing deviceId or audio data' });
      }

      if (!debugDataStore.has(deviceId)) {
        debugDataStore.set(deviceId, { hardware: [], camera: [], llm: [], storage: [], audio: [], performance: [], device: [] });
      }

      const deviceData = debugDataStore.get(deviceId);
      deviceData.audio.push({
        type: 'audio_captured',
        audioSize: audio.length,
        timestamp: timestamp || new Date().toISOString(),
        serverTimestamp: new Date().toISOString()
      });

      if (deviceData.audio.length > 20) {
        deviceData.audio = deviceData.audio.slice(-20);
      }

      console.log(`Audio captured from ${deviceId}, size: ${audio.length} bytes`);
      res.json({ status: 'stored' });
    } catch (error) {
      console.error('Error storing audio data:', error);
      res.status(500).json({ error: 'Failed to store audio data' });
    }
  });

  // Debug data streaming endpoints
  app.post('/debug/stream/:type', (req, res) => {
    try {
      const { type } = req.params;
      const { deviceId, data, timestamp } = req.body;

      if (!deviceId) {
        return res.status(400).json({ error: 'deviceId required' });
      }

      // Store debug data
      if (!debugStreams.has(deviceId)) {
        debugStreams.set(deviceId, {
          hardware: [],
          camera: [],
          llm: [],
          storage: [],
          audio: [],
          performance: [],
          device: [],
          logs: []
        });
      }

      const deviceStreams = debugStreams.get(deviceId);
      if (deviceStreams[type]) {
        // Keep last 100 entries per type
        deviceStreams[type].push({
          data,
          timestamp: timestamp || new Date().toISOString(),
          id: Date.now()
        });

        if (deviceStreams[type].length > 100) {
          deviceStreams[type].shift();
        }
      }

      // Broadcast to all connected clients (not the device itself)
      // This would need io reference, but for now skip
      res.json({ status: 'streamed', type, deviceId });
    } catch (error) {
      console.error('Error streaming debug data:', error);
      res.status(500).json({ error: 'Failed to stream debug data' });
    }
  });

  // Get debug data history
  app.get('/debug/history/:deviceId', (req, res) => {
    try {
      const { deviceId } = req.params;
      const { type, limit = 50 } = req.query;

      if (!debugStreams.has(deviceId)) {
        return res.json({ data: [] });
      }

      const deviceStreams = debugStreams.get(deviceId);

      if (type) {
        const data = deviceStreams[type] || [];
        res.json({
          data: data.slice(-limit),
          type,
          deviceId,
          count: data.length
        });
      } else {
        // Return all types
        const result = {};
        Object.keys(deviceStreams).forEach(streamType => {
          result[streamType] = deviceStreams[streamType].slice(-limit);
        });
        res.json({
          data: result,
          deviceId,
          types: Object.keys(deviceStreams)
        });
      }
    } catch (error) {
      console.error('Error getting debug history:', error);
      res.status(500).json({ error: 'Failed to get debug history' });
    }
  });
}

module.exports = {
  setupDebugRoutes
};