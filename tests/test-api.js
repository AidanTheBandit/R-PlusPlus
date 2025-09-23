const http = require('http');

// Test the OpenAI-compatible API
function testAPI() {
  const data = JSON.stringify({
    model: "r1-command",
    messages: [
      {
        role: "user",
        content: "Turn on the lights in the living room"
      }
    ],
    temperature: 0.7,
    max_tokens: 150
  });

  const options = {
    hostname: 'localhost',
    port: 5482,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(responseData);
        console.log('API Response:');
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.error('Error parsing response:', error);
        console.log('Raw response:', responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.write(data);
  req.end();
}

// Test health endpoint
function testHealth() {
  const options = {
    hostname: 'localhost',
    port: 5482,
    path: '/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('Health Check Response:');
      console.log(JSON.stringify(JSON.parse(responseData), null, 2));
    });
  });

  req.on('error', (error) => {
    console.error('Health check error:', error);
  });

  req.end();
}

// Test models endpoint
function testModels() {
  const options = {
    hostname: 'localhost',
    port: 5482,
    path: '/v1/models',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('Models Response:');
      console.log(JSON.stringify(JSON.parse(responseData), null, 2));
    });
  });

  req.on('error', (error) => {
    console.error('Models check error:', error);
  });

  req.end();
}

console.log('Testing R-API server...');
console.log('Make sure the server is running on localhost:5482\n');

setTimeout(() => {
  console.log('1. Testing health endpoint...');
  testHealth();
}, 1000);

setTimeout(() => {
  console.log('\n2. Testing models endpoint...');
  testModels();
}, 2000);

setTimeout(() => {
  console.log('\n3. Testing chat completions API...');
  testAPI();
}, 3000);