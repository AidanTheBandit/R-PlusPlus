// Server-side Groq AI processing for chat completions
// Processes requests directly instead of forwarding to a device

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Map R1 model names to Groq models
const MODEL_MAP = {
  'r1-command': 'llama-3.3-70b-versatile',
  'r1-llm': 'llama-3.3-70b-versatile',
  'gpt-3.5-turbo': 'llama-3.3-70b-versatile',
  'gpt-4': 'llama-3.3-70b-versatile',
  'gpt-4o': 'llama-3.3-70b-versatile',
};

function getGroqModel(model) {
  return MODEL_MAP[model] || 'llama-3.3-70b-versatile';
}

async function processWithGroq(messages, options = {}) {
  const { model = 'r1-command', temperature = 0.7, max_tokens = 150, response_format } = options;

  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const groqModel = getGroqModel(model);

  // Build the request body
  const body = {
    model: groqModel,
    messages: messages.map(m => ({
      role: m.role || 'user',
      content: m.content || m
    })),
    temperature: parseFloat(temperature),
    max_tokens: parseInt(max_tokens) || 1024,
  };

  // Support JSON mode
  if (response_format && response_format.type === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  console.log(`[groq] Processing with model ${groqModel}, ${body.messages.length} messages`);

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[groq] API error ${response.status}: ${errText.substring(0, 200)}`);
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  console.log(`[groq] Response received (${content.length} chars), tokens: ${data.usage?.total_tokens || 'unknown'}`);

  return {
    content,
    model: groqModel,
    usage: data.usage || {},
  };
}

module.exports = { processWithGroq, getGroqModel };
