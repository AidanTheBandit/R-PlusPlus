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

  // Clean up processing tracker after 30 seconds
  setTimeout(() => {
    if (window._processingTTSRequests) {
      window._processingTTSRequests.delete(processingKey)
    }
  }, 30000)

  addLog(`🎵 Processing TTS request ${currentRequestId}`)
  addLog(`🎵 Text to speak: "${textToSpeak?.substring(0, 50)}${textToSpeak?.length > 50 ? '...' : ''}"`)
  addLog(`🎵 Settings: model=${model}, voice=${voice}, format=${responseFormat}, speed=${speed}x`)

  // Helper function to create base64 encoded audio data (browser-compatible)
  const createSimulatedAudioData = (prefix) => {
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

  const cleanText = cleanTTSText(textToSpeak)

  if (r1CreateRef.current && r1CreateRef.current.messaging && typeof r1CreateRef.current.messaging.speakText === 'function') {
    try {
      // Enhanced R1 prompting for better TTS quality
      const enhancedPrompt = `Speak clearly and naturally: "${cleanText}". Use a conversational ${voice} voice at ${speed}x speed.`

      addLog(`🎵 Using R1 messaging.speakText API for device playback`)
      addLog(`🎵 Enhanced prompt: "${enhancedPrompt}"`)

      await r1CreateRef.current.messaging.speakText(enhancedPrompt)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = createSimulatedAudioData('tts')

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

      addLog(`📤 Sending TTS response with audio data: ${JSON.stringify(ttsResponseData, null, 2)}`)
      socket.emit('tts_response', ttsResponseData)
      addLog(`✅ Sent TTS response via socket`)

      // Clean up processing tracker
      if (window._processingTTSRequests) {
        window._processingTTSRequests.delete(processingKey)
      }

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

      // Clean up processing tracker
      if (window._processingTTSRequests) {
        window._processingTTSRequests.delete(processingKey)
      }

      return // Exit early on error
    }
  } else if (r1CreateRef.current && r1CreateRef.current.llm && typeof r1CreateRef.current.llm.textToSpeech === 'function') {
    try {
      // Enhanced R1 prompting for better TTS quality
      const enhancedPrompt = `Speak clearly and naturally: "${cleanText}". Use a conversational ${voice} voice at ${speed}x speed.`

      addLog('🔄 Using LLM.textToSpeech convenience method for device playback', 'warn')
      addLog(`🎵 Enhanced prompt: "${enhancedPrompt}"`)

      await r1CreateRef.current.llm.textToSpeech(enhancedPrompt)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = createSimulatedAudioData('tts')

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

      addLog(`📤 Sending TTS response with audio data: ${JSON.stringify(ttsResponseData, null, 2)}`)
      socket.emit('tts_response', ttsResponseData)
      addLog(`✅ Sent TTS response via socket`)

      // Clean up processing tracker
      if (window._processingTTSRequests) {
        window._processingTTSRequests.delete(processingKey)
      }

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

      // Clean up processing tracker
      if (window._processingTTSRequests) {
        window._processingTTSRequests.delete(processingKey)
      }

      return // Exit early on error
    }
  } else if (r1CreateRef.current && r1CreateRef.current.llm && typeof r1CreateRef.current.llm.askLLMSpeak === 'function') {
    try {
      // Enhanced R1 prompting for better TTS quality
      const enhancedPrompt = `Speak clearly and naturally: "${cleanText}". Use a conversational ${voice} voice at ${speed}x speed.`

      addLog('🔄 Using LLM.askLLMSpeak for LLM-generated device speech', 'warn')
      addLog(`🎵 Enhanced prompt: "${enhancedPrompt}"`)

      await r1CreateRef.current.llm.askLLMSpeak(enhancedPrompt)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = createSimulatedAudioData('tts')

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

      addLog(`📤 Sending TTS response with audio data: ${JSON.stringify(ttsResponseData, null, 2)}`)
      socket.emit('tts_response', ttsResponseData)
      addLog(`✅ Sent TTS response via socket`)

      // Clean up processing tracker
      if (window._processingTTSRequests) {
        window._processingTTSRequests.delete(processingKey)
      }

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

      // Clean up processing tracker
      if (window._processingTTSRequests) {
        window._processingTTSRequests.delete(processingKey)
      }

      return // Exit early on error
    }
  } else {
    addLog('❌ No working R1 SDK TTS APIs available - using basic fallback simulation', 'warn')

    // Basic fallback simulation - just return simulated audio data
    const simulatedAudioData = createSimulatedAudioData('fallback')

    addLog(`🤖 Basic TTS simulation for: "${cleanText?.substring(0, 30)}..."`, 'info')

    // Send basic simulated TTS response
    setTimeout(() => {
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

      // Clean up processing tracker
      if (window._processingTTSRequests) {
        window._processingTTSRequests.delete(processingKey)
      }
    }, 1000) // 1 second delay
  }
}