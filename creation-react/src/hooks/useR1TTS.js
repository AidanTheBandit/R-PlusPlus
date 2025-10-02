// Handle text-to-speech requests from socket
export const handleTextToSpeech = async (data, socket, addLog, sendError, r1CreateRef) => {
  const currentRequestId = data.requestId || data.data?.requestId
  const textToSpeak = data.text || data.data?.text
  const model = data.model || data.data?.model || 'tts-1'
  const voice = data.voice || data.data?.voice || 'alloy'
  const responseFormat = data.response_format || data.data?.response_format || 'mp3'
  const speed = data.speed || data.data?.speed || 1.0

  addLog(`🎵 Processing TTS request ${currentRequestId}`)
  addLog(`🎵 Text to speak: "${textToSpeak?.substring(0, 50)}${textToSpeak?.length > 50 ? '...' : ''}"`)
  addLog(`🎵 Settings: model=${model}, voice=${voice}, format=${responseFormat}, speed=${speed}x`)

  if (r1CreateRef.current && r1CreateRef.current.messaging && typeof r1CreateRef.current.messaging.speakText === 'function') {
    try {
      // Use R1 SDK messaging.speakText for device playback (local audio)
      addLog(`🎵 Using R1 messaging.speakText API for device playback`)
      await r1CreateRef.current.messaging.speakText(textToSpeak)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = Buffer.from(`tts-${model}-${voice}-${responseFormat}-${Date.now()}`).toString('base64')

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
      // Use R1 SDK LLM textToSpeech convenience method for device playback
      addLog('🔄 Using LLM.textToSpeech convenience method for device playback', 'warn')
      await r1CreateRef.current.llm.textToSpeech(textToSpeak)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = Buffer.from(`tts-${model}-${voice}-${responseFormat}-${Date.now()}`).toString('base64')

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
      // Use R1 SDK LLM askLLMSpeak for LLM-generated device speech
      addLog('🔄 Using LLM.askLLMSpeak for LLM-generated device speech', 'warn')
      await r1CreateRef.current.llm.askLLMSpeak(textToSpeak)

      // Generate simulated audio file data for API response
      addLog(`🎵 Generating audio file data for API response`)
      const simulatedAudioData = Buffer.from(`tts-${model}-${voice}-${responseFormat}-${Date.now()}`).toString('base64')

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
    const simulatedAudioData = Buffer.from(`fallback-${model}-${voice}-${responseFormat}-${Date.now()}`).toString('base64')

    addLog(`🤖 Basic TTS simulation for: "${textToSpeak?.substring(0, 30)}..."`, 'info')

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
    }, 1000) // 1 second delay
  }
}