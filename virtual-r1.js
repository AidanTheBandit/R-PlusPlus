#!/usr/bin/env node

const io = require('socket.io-client');
const fetch = require('node-fetch');

class VirtualR1 {
  constructor(deviceId, serverUrl = 'http://localhost:3000', openRouterKey = null) {
    this.deviceId = deviceId;
    this.serverUrl = serverUrl;
    this.openRouterKey = openRouterKey || process.env.OPENROUTER_API_KEY;
    this.socket = null;

    if (!this.openRouterKey) {
      console.error('❌ OPENROUTER_API_KEY environment variable is required');
      process.exit(1);
    }

    console.log(`🤖 Virtual R1 Device: ${deviceId}`);
    console.log(`🌐 Server: ${serverUrl}`);
    console.log(`🔑 OpenRouter: ${this.openRouterKey.substring(0, 8)}...`);
  }

  connect() {
    console.log(`🔌 Connecting to server...`);

    this.socket = io(this.serverUrl, {
      query: { deviceId: this.deviceId }
    });

    this.socket.on('connect', () => {
      console.log(`✅ Connected to server as ${this.deviceId}`);
    });

    this.socket.on('disconnect', () => {
      console.log(`❌ Disconnected from server`);
    });

    this.socket.on('chat_completion', async (data) => {
      await this.handleChatCompletion(data);
    });

    this.socket.on('connect_error', (error) => {
      console.error(`❌ Connection error:`, error.message);
    });
  }

  async handleChatCompletion(data) {
    const { message, messages, originalMessage, requestId, model, temperature, max_tokens } = data.data;

    console.log(`📨 Received chat completion request: ${requestId}`);
    console.log(`💬 Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

    try {
      // Prepare messages for OpenRouter
      const openRouterMessages = this.prepareMessagesForOpenRouter(messages, message);

      console.log(`🤖 Sending to OpenRouter...`);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Virtual R1 Test Client'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku:beta', // Fast and capable model
          messages: openRouterMessages,
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 150,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content || 'No response generated';

      console.log(`✅ OpenRouter response received`);
      console.log(`💭 Response: ${aiResponse.substring(0, 100)}${aiResponse.length > 100 ? '...' : ''}`);

      // Send response back to server
      this.socket.emit('chat_response', {
        requestId,
        response: aiResponse,
        deviceId: this.deviceId
      });

      console.log(`📤 Response sent back to server`);

    } catch (error) {
      console.error(`❌ Error processing chat completion:`, error);

      // Send error response back to server
      this.socket.emit('chat_response', {
        requestId,
        response: `Error: ${error.message}`,
        deviceId: this.deviceId,
        error: true
      });
    }
  }

  prepareMessagesForOpenRouter(messages, injectedMessage) {
    // The server injects system prompts and MCP data into the message field
    // We need to convert this to proper OpenRouter message format

    const openRouterMessages = [];

    // If we have a messages array from the server, use it
    if (messages && messages.length > 0) {
      // Convert server messages to OpenRouter format
      for (const msg of messages) {
        if (msg.role === 'system') {
          openRouterMessages.push({
            role: 'system',
            content: msg.content
          });
        } else if (msg.role === 'user') {
          openRouterMessages.push({
            role: 'user',
            content: msg.content
          });
        } else if (msg.role === 'assistant') {
          openRouterMessages.push({
            role: 'assistant',
            content: msg.content
          });
        }
      }
    } else {
      // Fallback: treat the injected message as a user message with system context
      openRouterMessages.push({
        role: 'user',
        content: injectedMessage
      });
    }

    return openRouterMessages;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log(`👋 Disconnected from server`);
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node virtual-r1.js <deviceId> [serverUrl]');
    console.log('Example: node virtual-r1.js test-device-001 http://localhost:3000');
    console.log('Environment: OPENROUTER_API_KEY must be set');
    process.exit(1);
  }

  const deviceId = args[0];
  const serverUrl = args[1] || 'http://localhost:3000';

  const virtualR1 = new VirtualR1(deviceId, serverUrl);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Virtual R1...');
    virtualR1.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Virtual R1...');
    virtualR1.disconnect();
    process.exit(0);
  });

  // Connect and start listening
  virtualR1.connect();
}