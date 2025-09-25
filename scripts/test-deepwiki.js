// Test script for DeepWiki MCP server using official SDK
const { MCPProtocolClient } = require('../src/utils/mcp-protocol-client');

async function testDeepWiki() {
  console.log('🧪 Testing DeepWiki MCP server with official SDK...');

  try {
    const client = new MCPProtocolClient('https://mcp.deepwiki.com/sse', {
      protocolVersion: '2025-06-18',
      clientInfo: {
        name: 'R-API-Test-Client',
        version: '1.0.0'
      },
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      timeout: 30000
    });

    console.log('📡 Initializing connection...');
    const initResult = await client.initialize();
    console.log('✅ Initialize successful:', JSON.stringify(initResult, null, 2));

    console.log('🔧 Listing tools...');
    const toolsResult = await client.listTools();
    console.log('✅ Tools available:', JSON.stringify(toolsResult, null, 2));

    if (toolsResult.tools && toolsResult.tools.length > 0) {
      console.log('🛠️ Testing first tool...');
      const firstTool = toolsResult.tools[0];
      console.log(`Testing tool: ${firstTool.name}`);

      // Test with minimal arguments first
      try {
        const testArgs = {};
        if (firstTool.inputSchema?.properties) {
          // Try to provide minimal valid arguments
          const props = firstTool.inputSchema.properties;
          for (const [key, schema] of Object.entries(props)) {
            if (schema.type === 'string') {
              testArgs[key] = 'test';
            } else if (schema.type === 'number') {
              testArgs[key] = 1;
            } else if (schema.type === 'boolean') {
              testArgs[key] = true;
            }
            break; // Just test with first required property
          }
        }

        console.log('Test arguments:', testArgs);
        const toolResult = await client.callTool(firstTool.name, testArgs);
        console.log('✅ Tool call successful:', JSON.stringify(toolResult, null, 2));
      } catch (error) {
        console.log('⚠️ Tool call failed (expected for test):', error.message);
      }
    }

    await client.close();
    console.log('🔌 Connection closed successfully');

  } catch (error) {
    console.error('❌ DeepWiki test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

if (require.main === module) {
  testDeepWiki().then(() => {
    console.log('🎉 DeepWiki test completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 DeepWiki test failed:', error);
    process.exit(1);
  });
}

module.exports = { testDeepWiki };