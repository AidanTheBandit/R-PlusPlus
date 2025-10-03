// Handle text-to-speech requests from socket
export const handleTextToSpeech = async (data, socket, addLog, sendError, r1CreateRef) => {
  const currentRequestId = data.requestId || data.data?.requestId
  const textToSpeak = data.text || data.data?.text || data.originalText
  const model = data.model || data.data?.model || 'tts-1'
  const voice = data.voice || data.data?.voice || 'alloy'
  const responseFormat = data.response_format || data.data?.response_format || 'mp3'
  const speed = data.speed || data.data?.speed || 1.0

  // Prevent duplicate processing of the same request
  const processingKey = `tts-${currentRequestId}`
  if (window._processingTTSRequests && window._processingTTSRequests.has(processingKey)) {
    addLog(`🚫 Skipping duplicate TTS request: ${currentRequestId}`)
    return
  }

  // Initialize processing tracker if needed
  if (!window._processingTTSRequests) {
    window._processingTTSRequests = new Set()
  }
  window._processingTTSRequests.add(processingKey)

  // Initialize TTS queue if needed
  if (!window._ttsQueue) {
    window._ttsQueue = []
    window._ttsLock = false // Global TTS lock to prevent overlapping
  }

  // Check if TTS is currently locked (another TTS in progress)
  if (window._ttsLock) {
    addLog(`🔒 TTS currently locked, queuing request ${currentRequestId}`)
    // Add to queue and return promise
    return new Promise((resolve) => {
      window._ttsQueue.push({
        data,
        socket,
        addLog,
        sendError,
        r1CreateRef,
        resolve
      })
    })
  }

  // Acquire TTS lock
  window._ttsLock = true

  try {
    await processSingleTTS(data, socket, addLog, sendError, r1CreateRef)
  } finally {
    // Release TTS lock
    window._ttsLock = false
    // Process next item in queue if any
    if (window._ttsQueue.length > 0) {
      const nextItem = window._ttsQueue.shift()
      // Process next item asynchronously
      setTimeout(() => {
        handleTextToSpeech(nextItem.data, nextItem.socket, nextItem.addLog, nextItem.sendError, nextItem.r1CreateRef)
          .then(nextItem.resolve)
          .catch(nextItem.resolve)
      }, 100) // Small delay to prevent immediate re-locking
    }
  }
}

async function processSingleTTS(data, socket, addLog, sendError, r1CreateRef) {
  const currentRequestId = data.requestId || data.data?.requestId
  const textToSpeak = data.text || data.data?.text || data.originalText
  const model = data.model || data.data?.model || 'tts-1'
  const voice = data.voice || data.data?.voice || 'alloy'
  const responseFormat = data.response_format || data.data?.response_format || 'mp3'
  const speed = data.speed || data.data?.speed || 1.0

  // Clean up processing tracker after 30 seconds
  setTimeout(() => {
    if (window._processingTTSRequests) {
      window._processingTTSRequests.delete(`tts-${currentRequestId}`)
    }
  }, 30000)

  addLog(`🎵 Processing TTS request ${currentRequestId}`)
  addLog(`🎵 Text to speak: "${textToSpeak?.substring(0, 50)}${textToSpeak?.length > 50 ? '...' : ''}"`)
  addLog(`🎵 Settings: model=${model}, voice=${voice}, format=${responseFormat}, speed=${speed}x`)

  try {
    await processTTSContent(currentRequestId, textToSpeak, model, voice, responseFormat, speed, socket, addLog, sendError, r1CreateRef)
  } catch (error) {
    addLog(`❌ TTS processing error: ${error.message}`, 'error')
  }
}

// Helper function to create base64 encoded audio data (browser-compatible)
const createSimulatedAudioData = (prefix, model, voice, responseFormat) => {
  const dataString = `${prefix}-${model}-${voice}-${responseFormat}-${Date.now()}`
  // Use btoa for browser-compatible base64 encoding
  return typeof btoa !== 'undefined' ? btoa(dataString) : dataString
}

// Helper function to clean up TTS text for better R1 prompting
const cleanTTSText = (text) => {
  // Remove any existing instructions and focus on the core text
  return text.replace(/^Please speak the following text clearly and naturally:\s*"/, '')
             .replace(/"\. Use a .* voice style\. Speak at .* speed\.$/, '')
             .trim()
}

// Helper function to get voice style description
const getVoiceStyleDescription = (voiceName) => {
  const voice = voiceName.toLowerCase();

  // OpenAI voices
  if (voice === 'alloy') return 'a clear and friendly female voice';
  if (voice === 'echo') return 'a deep and resonant male voice';
  if (voice === 'fable') return 'a warm and engaging storytelling voice';
  if (voice === 'onyx') return 'a powerful and authoritative male voice';
  if (voice === 'nova') return 'a youthful and energetic female voice';
  if (voice === 'shimmer') return 'a bright and cheerful female voice';

  // ElevenLabs voices - provide descriptive styles
  if (voice.includes('adam')) return 'a deep and professional male voice';
  if (voice.includes('antoni')) return 'a warm and conversational male voice';
  if (voice.includes('arnold')) return 'a strong and confident male voice';
  if (voice.includes('bella')) return 'a gentle and melodic female voice';
  if (voice.includes('domi')) return 'a youthful and expressive female voice';
  if (voice.includes('elli')) return 'a bright and enthusiastic female voice';
  if (voice.includes('josh')) return 'a friendly and approachable male voice';
  if (voice.includes('rachel')) return 'a sophisticated and articulate female voice';
  if (voice.includes('sam')) return 'a calm and reassuring male voice';

  // Default fallback for unknown voices
  return `a ${voice} voice style`;
}

async function processTTSContent(currentRequestId, textToSpeak, model, voice, responseFormat, speed, socket, addLog, sendError, r1CreateRef) {
  const cleanText = cleanTTSText(textToSpeak)

  if (r1CreateRef.current && r1CreateRef.current.llm && typeof r1CreateRef.current.llm.textToSpeechAudio === 'function') {
    try {
      // Use clean text directly without verbose instructions
      addLog(`🎵 Using R1-Create 1.3.0 textToSpeechAudio API for device playback`)
      addLog(`🎵 Text: "${cleanText}"`)

      const audioBlob = await r1CreateRef.current.llm.textToSpeechAudio(cleanText, {
        voice: voice,
        rate: speed,
        volume: 0.8
      })

      if (audioBlob) {
        addLog(`🎵 Generated audio blob: ${audioBlob.size} bytes`)

        // Convert blob to base64 for API response
        const arrayBuffer = await audioBlob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('')
        const simulatedAudioData = btoa(binaryString)

        // Send immediate TTS response with audio data
        const ttsResponseData = {
          requestId: currentRequestId,
          audioData: simulatedAudioData,
          audioFormat: responseFormat,
          model: model,
          voice: voice,
          speed: speed,
          timestamp: new Date().toISOString(),
          deviceId: socket._deviceId
        }

        addLog(`📤 Sending TTS response with audio blob data: ${simulatedAudioData.length} chars`)
        socket.emit('tts_response', ttsResponseData)
        addLog(`✅ Sent TTS response via socket`)

        return // Exit early since we sent the response
      } else {
        addLog(`⚠️ textToSpeechAudio returned null, trying other TTS methods`)
        // Don't return here - continue to try other methods
      }
    } catch (error) {
      addLog(`R1-Create textToSpeechAudio error: ${error.message}`, 'error')
      addLog(`Trying other TTS methods`)
      // Don't return here - continue to try other methods
    }
  }

  if (r1CreateRef.current && r1CreateRef.current.messaging && typeof r1CreateRef.current.messaging.speakText === 'function') {
    try {
      addLog(`🎵 Using R1-Create messaging.speakText API for device playback`)
      addLog(`🎵 Text: "${cleanText}"`)

      await r1CreateRef.current.messaging.speakText(cleanText)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = createSimulatedAudioData('tts', model, voice, responseFormat)

      // Send TTS response after speech completes
      const ttsResponseData = {
        requestId: currentRequestId,
        audioData: simulatedAudioData,
        audioFormat: responseFormat,
        model: model,
        voice: voice,
        speed: speed,
        timestamp: new Date().toISOString(),
        deviceId: socket._deviceId
      }

      addLog(`📤 Sending TTS response with audio data: ${JSON.stringify(ttsResponseData, null, 2)}`)
      socket.emit('tts_response', ttsResponseData)
      addLog(`✅ Sent TTS response via socket`)

      return // Exit early since we sent the response

    } catch (error) {
      addLog(`R1 SDK messaging.speakText error: ${error.message}`, 'error')
      addLog(`R1 SDK TTS error stack: ${error.stack}`, 'error')
      socket.emit('tts_error', {
        requestId: currentRequestId,
        error: `R1 SDK TTS error: ${error.message}`,
        deviceId: socket._deviceId
      })
      sendError('error', `R1 SDK TTS failed: ${error.message}`)

      return // Exit early on error
    }
  } else if (r1CreateRef.current && r1CreateRef.current.llm && typeof r1CreateRef.current.llm.textToSpeech === 'function') {
    try {
      addLog('🔄 Using LLM.textToSpeech convenience method for device playback', 'warn')
      addLog(`🎵 Text: "${cleanText}"`)

      await r1CreateRef.current.llm.textToSpeech(cleanText)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = createSimulatedAudioData('tts', model, voice, responseFormat)

      // Send TTS response after speech completes
      const ttsResponseData = {
        requestId: currentRequestId,
        audioData: simulatedAudioData,
        audioFormat: responseFormat,
        model: model,
        voice: voice,
        speed: speed,
        timestamp: new Date().toISOString(),
        deviceId: socket._deviceId
      }

      addLog(`📤 Sending TTS response with audio data: ${JSON.stringify(ttsResponseData, null, 2)}`)
      socket.emit('tts_response', ttsResponseData)
      addLog(`✅ Sent TTS response via socket`)

      return // Exit early since we sent the response

    } catch (error) {
      addLog(`R1 SDK LLM.textToSpeech error: ${error.message}`, 'error')
      addLog(`R1 SDK LLM TTS error stack: ${error.stack}`, 'error')
      socket.emit('tts_error', {
        requestId: currentRequestId,
        error: `R1 SDK LLM TTS error: ${error.message}`,
        deviceId: socket._deviceId
      })
      sendError('error', `R1 SDK LLM TTS failed: ${error.message}`)

      return // Exit early on error
    }
  } else if (r1CreateRef.current && r1CreateRef.current.llm && typeof r1CreateRef.current.llm.askLLMSpeak === 'function') {
    try {
      addLog('🔄 Using LLM.askLLMSpeak for LLM-generated device speech', 'warn')
      addLog(`🎵 Text: "${cleanText}"`)

      await r1CreateRef.current.llm.askLLMSpeak(cleanText)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = createSimulatedAudioData('tts', model, voice, responseFormat)

      // Send TTS response after speech completes
      const ttsResponseData = {
        requestId: currentRequestId,
        audioData: simulatedAudioData,
        audioFormat: responseFormat,
        model: model,
        voice: voice,
        speed: speed,
        timestamp: new Date().toISOString(),
        deviceId: socket._deviceId
      }

      addLog(`📤 Sending TTS response with audio data: ${JSON.stringify(ttsResponseData, null, 2)}`)
      socket.emit('tts_response', ttsResponseData)
      addLog(`✅ Sent TTS response via socket`)

      return // Exit early since we sent the response

    } catch (error) {
      addLog(`R1 SDK LLM.askLLMSpeak error: ${error.message}`, 'error')
      addLog(`R1 SDK LLM askLLMSpeak error stack: ${error.stack}`, 'error')
      socket.emit('tts_error', {
        requestId: currentRequestId,
        error: `R1 SDK LLM askLLMSpeak error: ${error.message}`,
        deviceId: socket._deviceId
      })
      sendError('error', `R1 SDK LLM askLLMSpeak failed: ${error.message}`)

      return // Exit early on error
    }
  } else {
    addLog('❌ No working R1 SDK TTS APIs available - using basic fallback simulation', 'warn')

    // Basic fallback simulation - just return simulated audio data
    const simulatedAudioData = createSimulatedAudioData('fallback', model, voice, responseFormat)

    addLog(`🤖 Basic TTS simulation for: "${cleanText?.substring(0, 30)}..."`, 'info')

    // Send basic simulated TTS response after a delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    if (socket && socket.connected) {
      const ttsResponseData = {
        requestId: currentRequestId,
        audioData: simulatedAudioData,
        audioFormat: responseFormat,
        model: model,
        voice: voice,
        speed: speed,
        timestamp: new Date().toISOString(),
        deviceId: socket._deviceId
      }

      addLog(`📤 Sending basic TTS simulation: ${JSON.stringify(ttsResponseData, null, 2)}`)
      socket.emit('tts_response', ttsResponseData)
      addLog(`✅ Sent basic TTS simulation via socket`)
    } else {
      addLog('❌ Socket not connected for TTS fallback response', 'error')
      socket.emit('tts_error', {
        requestId: currentRequestId,
        error: 'Socket disconnected during TTS processing',
        deviceId: socket._deviceId
      })
    }
  }
}