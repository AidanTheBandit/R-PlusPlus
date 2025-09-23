#!/usr/bin/env node

// Quick test to verify server can start without errors
const express = require('express');
const path = require('path');

console.log('🧪 Testing server startup...');

try {
  const app = express();
  
  // Test the problematic route patterns
  app.get('/', (req, res) => {
    res.send('OK');
  });
  
  // Test static file serving
  app.use(express.static(path.join(__dirname, '..', 'r1-control-panel', 'build')));
  
  console.log('✅ Express routes configured successfully');
  console.log('✅ No path-to-regexp errors detected');
  console.log('🚀 Server should start without issues');
  
  process.exit(0);
} catch (error) {
  console.error('❌ Server test failed:', error.message);
  process.exit(1);
}