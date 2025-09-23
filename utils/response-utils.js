// Utility functions for handling OpenAI-compatible responses

function sendOpenAIResponse(clientRes, response, originalMessage, model, stream = false) {
  if (stream) {
    // Set headers for SSE
    clientRes.setHeader('Content-Type', 'text/plain; charset=utf-8');
    clientRes.setHeader('Cache-Control', 'no-cache');
    clientRes.setHeader('Connection', 'keep-alive');

    const id = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    // Send role chunk first
    const roleChunk = {
      id,
      object: 'chat.completion.chunk',
      created,
      model: model || 'r1-llm',
      choices: [{
        index: 0,
        delta: {
          role: 'assistant'
        },
        finish_reason: null
      }]
    };
    clientRes.write(`data: ${JSON.stringify(roleChunk)}\n\n`);

    // Split content into words and send progressively
    const content = response || 'No response from R1';
    const words = content.split(' ');
    let wordIndex = 0;

    const sendNextWord = () => {
      if (wordIndex < words.length) {
        const word = words[wordIndex] + (wordIndex < words.length - 1 ? ' ' : '');
        const contentChunk = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: model || 'r1-llm',
          choices: [{
            index: 0,
            delta: {
              content: word
            },
            finish_reason: null
          }]
        };
        clientRes.write(`data: ${JSON.stringify(contentChunk)}\n\n`);
        wordIndex++;
        // Send next word after a small delay to simulate streaming
        setTimeout(sendNextWord, 50); // 50ms delay between words
      } else {
        // Send finish chunk
        const finishChunk = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: model || 'r1-llm',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }]
        };
        clientRes.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
        clientRes.write(`data: [DONE]\n\n`);
        clientRes.end();
      }
    };

    // Start sending words after role
    setTimeout(sendNextWord, 100);
  } else {
    const openaiResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'r1-llm',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response || 'No response from R1'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: originalMessage ? originalMessage.length : 0,
        completion_tokens: response ? response.length : 0,
        total_tokens: (originalMessage ? originalMessage.length : 0) + (response ? response.length : 0)
      }
    };

    clientRes.json(openaiResponse);
  }

  console.log(`📤 Sending ${stream ? 'streaming' : 'normal'} OpenAI response to client:`, (response || 'No response from R1').substring(0, 100));
}

module.exports = {
  sendOpenAIResponse
};