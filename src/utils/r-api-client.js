// R-API Client for device-specific API calls
class RApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || window.location.origin;
  }

  // Make a chat completion request to a specific device
  async chatCompletion(messages, options = {}, deviceId = null) {
    const endpoint = deviceId
      ? `/device-${deviceId}/v1/chat/completions`
      : '/v1/chat/completions';

    const payload = {
      messages,
      model: options.model || 'r1-command',
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 150,
      stream: options.stream || false,
      ...options
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  // Get available models for a specific device
  async getModels(deviceId = null) {
    const endpoint = deviceId
      ? `/device-${deviceId}/v1/models`
      : '/v1/models';

    const response = await fetch(`${this.baseUrl}${endpoint}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  // Get health status
  async getHealth() {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  // Debug methods removed - leaked device IDs and sensitive data
  // async getDebugDevices() {
  //   const response = await fetch(`${this.baseUrl}/debug/devices`);

  //   if (!response.ok) {
  //     throw new Error(`HTTP ${response.status}`);
  //   }

  //   return await response.json();
  // }

  // async getDebugData(deviceId) {
  //   const response = await fetch(`${this.baseUrl}/debug/data/${deviceId}`);

  //   if (!response.ok) {
  //     throw new Error(`HTTP ${response.status}`);
  //   }

  //   return await response.json();
  // }

  // async getDebugLogs(deviceId) {
  //   const response = await fetch(`${this.baseUrl}/debug/logs/${deviceId}`);

  //   if (!response.ok) {
  //     throw new Error(`HTTP ${response.status}`);
  //   }

  //   return await response.json();
  // }

  // async clearDebugData(deviceId) {
  //   const response = await fetch(`${this.baseUrl}/debug/clear/${deviceId}`, {
  //     method: 'POST'
  //   });

  //   if (!response.ok) {
  //     throw new Error(`HTTP ${response.status}`);
  //   }

  //   return await response.json();
  // }

  // Magic cam controls - Device-specific
  async startMagicCam(deviceId, facingMode = 'user') {
    const response = await fetch(`${this.baseUrl}/${deviceId}/magic-cam/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facingMode })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async stopMagicCam(deviceId) {
    const response = await fetch(`${this.baseUrl}/${deviceId}/magic-cam/stop`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async captureMagicCam(deviceId, width = 240, height = 282) {
    const response = await fetch(`${this.baseUrl}/${deviceId}/magic-cam/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width, height })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async switchMagicCam(deviceId) {
    const response = await fetch(`${this.baseUrl}/${deviceId}/magic-cam/switch`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async getMagicCamStatus(deviceId) {
    const response = await fetch(`${this.baseUrl}/${deviceId}/magic-cam/status`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.RApiClient = RApiClient;
}

module.exports = RApiClient;