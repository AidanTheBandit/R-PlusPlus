#!/usr/bin/env node

// Test script for Virtual R1 client
// This script demonstrates how to test MCP functionality with the virtual R1

const fetch = require('node-fetch');

async function testVirtualR1() {
  const deviceId = 'virtual-r1-test';
  const baseUrl = 'http://localhost:3000';

  console.log('🧪 Testing Virtual R1 MCP functionality...\n');

  // Test 1: Basic MCP request
  console.log('📝 Test 1: Repository structure lookup');
  try {
    const response1 = await fetch(`${baseUrl}/${deviceId}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'facebook/react using mcp' }],
        model: 'r1-command',
        temperature: 0.7,
        max_tokens: 200
      })
    });

    const result1 = await response1.json();
    console.log('✅ Response:', result1.choices?.[0]?.message?.content || 'No response');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Non-MCP request
  console.log('📝 Test 2: Regular conversation');
  try {
    const response2 = await fetch(`${baseUrl}/${deviceId}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        model: 'r1-command',
        temperature: 0.7,
        max_tokens: 100
      })
    });

    const result2 = await response2.json();
    console.log('✅ Response:', result2.choices?.[0]?.message?.content || 'No response');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Another MCP request
  console.log('📝 Test 3: VSCode repository lookup');
  try {
    const response3 = await fetch(`${baseUrl}/${deviceId}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'microsoft/vscode using mcp' }],
        model: 'r1-command',
        temperature: 0.7,
        max_tokens: 200
      })
    });

    const result3 = await response3.json();
    console.log('✅ Response:', result3.choices?.[0]?.message?.content || 'No response');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🎉 Virtual R1 testing complete!');
}

// Run the test if this script is executed directly
if (require.main === module) {
  testVirtualR1().catch(console.error);
}

module.exports = { testVirtualR1 };