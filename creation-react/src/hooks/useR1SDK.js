import { useRef, useEffect } from 'react'
import { r1 } from 'r1-create'

export function useR1SDK(addConsoleLog, sendErrorToServer, socketRef) {
  const r1CreateRef = useRef(null)

  // Handle text-to-speech requests from socket
  const handleTextToSpeech = async (data, socket, addLog, sendError) => {
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
        // Use R1 SDK messaging.speakText for direct text-to-speech
        addLog(`🎵 Using R1 messaging.speakText API for direct TTS`)
        await r1CreateRef.current.messaging.speakText(textToSpeak)

        // Store the requestId for when we get the audio response
        if (currentRequestId) {
          socket._pendingTTSRequestId = currentRequestId
          socket._ttsSettings = { model, voice, responseFormat, speed }
          addLog(`📝 Stored pending TTS request: ${currentRequestId}`)
        }

        addLog(`📤 Sent TTS request to R1 messaging.speakText API, requestId: ${currentRequestId}`)

        // Send immediate acknowledgment that we received the request
        socket.emit('tts_received', {
          requestId: currentRequestId,
          deviceId: socket._deviceId,
          timestamp: new Date().toISOString()
        })

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
        // Use R1 SDK LLM textToSpeech convenience method
        addLog('🔄 Using LLM.textToSpeech convenience method for TTS', 'warn')

        await r1CreateRef.current.llm.textToSpeech(textToSpeak)

        // Store the requestId for when we get the audio response
        if (currentRequestId) {
          socket._pendingTTSRequestId = currentRequestId
          socket._ttsSettings = { model, voice, responseFormat, speed }
          addLog(`📝 Stored pending TTS request: ${currentRequestId}`)
        }

        addLog(`📤 Sent TTS request to R1 LLM.textToSpeech API, requestId: ${currentRequestId}`)

        // Send immediate acknowledgment that we received the request
        socket.emit('tts_received', {
          requestId: currentRequestId,
          deviceId: socket._deviceId,
          timestamp: new Date().toISOString()
        })

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
        // Use R1 SDK LLM askLLMSpeak for LLM-generated speech
        addLog('🔄 Using LLM.askLLMSpeak for LLM-generated TTS', 'warn')

        await r1CreateRef.current.llm.askLLMSpeak(textToSpeak)

        // Store the requestId for when we get the audio response
        if (currentRequestId) {
          socket._pendingTTSRequestId = currentRequestId
          socket._ttsSettings = { model, voice, responseFormat, speed }
          addLog(`📝 Stored pending TTS request: ${currentRequestId}`)
        }

        addLog(`📤 Sent TTS request to R1 LLM.askLLMSpeak API, requestId: ${currentRequestId}`)

        // Send immediate acknowledgment that we received the request
        socket.emit('tts_received', {
          requestId: currentRequestId,
          deviceId: socket._deviceId,
          timestamp: new Date().toISOString()
        })

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

      // Basic fallback simulation
      const simulatedAudioData = Buffer.from('basic-simulated-audio-data').toString('base64')

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

  // Handle chat completion requests from socket
  const handleChatCompletion = (data, socket, addLog, sendError) => {
    const currentRequestId = data.requestId || data.data?.requestId
    const messageToSend = data.message || data.data?.message
    const useLLM = data.useLLM !== undefined ? data.useLLM : (data.data?.useLLM !== undefined ? data.data.useLLM : true)
    const wantsR1Response = data.wantsR1Response !== undefined ? data.wantsR1Response : (data.data?.wantsR1Response !== undefined ? data.data.wantsR1Response : false)
    const wantsJournalEntry = true // Always save to journal as per requirements

    // Extract image data if present
    const imageBase64 = data.imageBase64 || data.data?.imageBase64
    const pluginId = data.pluginId || data.data?.pluginId

    addLog(`📤 Processing request ${currentRequestId}`)
    addLog(`📤 Message to send: "${messageToSend}"`)
    if (imageBase64) {
      addLog(`📸 Image data detected (${imageBase64.length} chars)`)
    }
    if (pluginId) {
      addLog(`🔌 Plugin ID: ${pluginId}`)
    }
    addLog(`📤 Options: useLLM=${useLLM}, wantsR1Response=${wantsR1Response}, wantsJournalEntry=${wantsJournalEntry}`)

    if (r1CreateRef.current && r1CreateRef.current.messaging) {
      try {
        // Prepare message options
        const messageOptions = {
          useLLM: useLLM,
          wantsR1Response: wantsR1Response,
          wantsJournalEntry: wantsJournalEntry,
          requestId: currentRequestId
        }

        // Add image data if present
        if (imageBase64) {
          messageOptions.imageBase64 = imageBase64
          addLog(`📸 Including image data in message options`)
        }

        // Add plugin ID if present
        if (pluginId) {
          messageOptions.pluginId = pluginId
          addLog(`🔌 Including plugin ID in message options: ${pluginId}`)
        }

        // Check if we should use vision API for image processing
        if (imageBase64 && (r1CreateRef.current.vision || r1CreateRef.current.image)) {
          addLog(`👁️ Using vision API for image processing`)

          const visionAPI = r1CreateRef.current.vision || r1CreateRef.current.image
          visionAPI.analyzeImage(imageBase64, {
            message: messageToSend,
            pluginId: pluginId,
            ...messageOptions
          })
        } else {
          // Use regular messaging API
          addLog(`💬 Using messaging API${imageBase64 ? ' with image data' : ''}`)
          r1CreateRef.current.messaging.sendMessage(messageToSend, messageOptions)
        }

        // Store the requestId for when we get the response
        if (currentRequestId) {
          socket._pendingRequestId = currentRequestId
          socket._originalMessage = data.originalMessage || data.data?.originalMessage
          addLog(`📝 Stored pending request: ${currentRequestId}`)
        }

        addLog(`📤 Sent message to R1 ${imageBase64 ? 'vision' : 'LLM'} API, requestId: ${currentRequestId}`)

        // Send immediate acknowledgment that we received the request
        socket.emit('message_received', {
          requestId: currentRequestId,
          deviceId: socket._deviceId,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        addLog(`R1 SDK messaging error: ${error.message}`, 'error')
        addLog(`R1 SDK error stack: ${error.stack}`, 'error')
        socket.emit('error', {
          requestId: data.requestId || data.data?.requestId,
          error: `R1 SDK messaging error: ${error.message}`,
          deviceId: socket._deviceId
        })
        sendError('error', `R1 SDK messaging failed: ${error.message}`)
      }
    } else {
      addLog('❌ R1 SDK messaging not available - using fallback simulation', 'warn')

      // For testing purposes, simulate an R1 response when SDK is not available
      let simulatedResponse = `Hello! This is a simulated response from the R1 device. You said: "${messageToSend}". The R1 SDK is not available in this browser environment, but the socket communication is working correctly.`

      // Add image processing simulation if image data is present
      if (imageBase64) {
        simulatedResponse += `\n\n📸 Image detected! In a real R1 device, I would analyze this image (${imageBase64.length} characters of base64 data).`
        if (pluginId) {
          simulatedResponse += ` Using plugin: ${pluginId}`

          // Simulate different plugin responses
          if (pluginId === 'image-analyzer') {
            simulatedResponse += `\n\n🔍 Image Analysis Result: This appears to be a test image (1x1 pixel). The image contains minimal visual data and appears to be used for testing purposes.`
          }
        }
      }

      addLog(`🤖 Simulating R1 response: "${simulatedResponse.substring(0, 50)}..."`, 'info')

      // Send simulated response after a short delay to mimic processing time
      setTimeout(() => {
        if (socket && socket.connected) {
          const responseData = {
            requestId: currentRequestId,
            response: simulatedResponse,
            originalMessage: data.originalMessage || data.data?.originalMessage,
            model: 'r1-llm-simulated',
            timestamp: new Date().toISOString(),
            deviceId: socket._deviceId
          }

          addLog(`📤 Sending simulated response: ${JSON.stringify(responseData, null, 2)}`)
          socket.emit('response', responseData)
          addLog(`✅ Sent simulated R1 response via socket`)
        }
      }, imageBase64 ? 2000 : 1000) // Longer delay for image processing simulation
    }
  }

  useEffect(() => {
    try {
      addConsoleLog('🔍 Checking R1 SDK availability...', 'info')
      addConsoleLog(`🔍 r1 object exists: ${!!r1}`, 'info')
      addConsoleLog(`🔍 r1.messaging exists: ${!!(r1 && r1.messaging)}`, 'info')

      // Check if R1 SDK is available
      if (r1 && r1.messaging) {
        r1CreateRef.current = r1
        addConsoleLog('✅ R1 SDK available and initialized', 'info')

        // Check what APIs are available
        const availableAPIs = []
        if (r1.messaging) availableAPIs.push('messaging')
        if (r1.llm) availableAPIs.push('llm')
        if (r1.camera) availableAPIs.push('camera')
        if (r1.hardware) availableAPIs.push('hardware')
        if (r1.storage) availableAPIs.push('storage')
        if (r1.microphone) availableAPIs.push('microphone')
        if (r1.speaker) availableAPIs.push('speaker')
        if (r1.vision) availableAPIs.push('vision')
        if (r1.image) availableAPIs.push('image')
        if (r1.tts) availableAPIs.push('tts')

        addConsoleLog(`📋 Available R1 APIs: ${availableAPIs.join(', ')}`, 'info')

        // Test the messaging API
        try {
          addConsoleLog('🧪 Testing R1 messaging API...', 'info')
          // Just check if the methods exist
          if (typeof r1.messaging.sendMessage === 'function') {
            addConsoleLog('✅ r1.messaging.sendMessage is available', 'info')
          } else {
            addConsoleLog('❌ r1.messaging.sendMessage is not a function', 'error')
          }

          if (typeof r1.messaging.onMessage === 'function') {
            addConsoleLog('✅ r1.messaging.onMessage is available', 'info')
          } else {
            addConsoleLog('❌ r1.messaging.onMessage is not a function', 'error')
          }

          if (typeof r1.messaging.speakText === 'function') {
            addConsoleLog('✅ r1.messaging.speakText is available', 'info')
          } else {
            addConsoleLog('❌ r1.messaging.speakText is not a function', 'error')
          }
        } catch (testError) {
          addConsoleLog(`❌ Error testing R1 messaging API: ${testError.message}`, 'error')
        }

        // Test TTS APIs
        try {
          addConsoleLog('🧪 Testing R1 TTS APIs...', 'info')

          if (r1.tts) {
            addConsoleLog('✅ r1.tts API is available', 'info')
            if (typeof r1.tts.speak === 'function') {
              addConsoleLog('✅ r1.tts.speak is available', 'info')
            } else {
              addConsoleLog('❌ r1.tts.speak is not a function', 'error')
            }
            if (typeof r1.tts.speakText === 'function') {
              addConsoleLog('✅ r1.tts.speakText is available', 'info')
            } else {
              addConsoleLog('❌ r1.tts.speakText is not a function', 'error')
            }
          } else {
            addConsoleLog('❌ r1.tts API is not available', 'error')
          }

          if (r1.speaker) {
            if (typeof r1.speaker.speakText === 'function') {
              addConsoleLog('✅ r1.speaker.speakText is available', 'info')
            } else {
              addConsoleLog('❌ r1.speaker.speakText is not a function', 'error')
            }
          }

          if (r1.llm) {
            if (typeof r1.llm.textToSpeech === 'function') {
              addConsoleLog('✅ r1.llm.textToSpeech is available', 'info')
            } else {
              addConsoleLog('❌ r1.llm.textToSpeech is not a function', 'error')
            }
            if (typeof r1.llm.generateSpeech === 'function') {
              addConsoleLog('✅ r1.llm.generateSpeech is available', 'info')
            } else {
              addConsoleLog('❌ r1.llm.generateSpeech is not a function', 'error')
            }
          }
        } catch (ttsTestError) {
          addConsoleLog(`❌ Error testing R1 TTS APIs: ${ttsTestError.message}`, 'error')
        }

        // Set up message handler for LLM responses
        try {
          r1.messaging.onMessage((response) => {
            addConsoleLog(`📤 R1 SDK message received: ${JSON.stringify(response, null, 2)}`)

            // The R1 responds with {"message":"text"}, so extract the response text
            const responseText = response.message || response.content || response || 'No response text'

            addConsoleLog(`📤 Extracted response text: "${responseText}"`)
            addConsoleLog(`📤 Current pending request ID: ${socketRef.current?._pendingRequestId}`)

            // Send response via socket (server will handle requestId matching)
            if (socketRef.current && socketRef.current.connected) {
              const currentDeviceId = socketRef.current._deviceId
              const responseData = {
                requestId: socketRef.current._pendingRequestId,
                response: responseText,
                originalMessage: socketRef.current._originalMessage,
                model: 'r1-llm',
                timestamp: new Date().toISOString(),
                deviceId: currentDeviceId
              }

              addConsoleLog(`📤 Sending response data: ${JSON.stringify(responseData, null, 2)}`)

              socketRef.current.emit('response', responseData)
              addConsoleLog(`📤 Sent R1 SDK response via socket: "${responseText.substring(0, 50)}..." (requestId: ${socketRef.current._pendingRequestId})`)

              // Clear the pending request data
              socketRef.current._pendingRequestId = null
              socketRef.current._originalMessage = null
            } else {
              addConsoleLog('Socket not connected, cannot send response', 'error')
            }
          })
          addConsoleLog('✅ R1 messaging onMessage handler set up', 'info')
        } catch (handlerError) {
          addConsoleLog(`❌ Error setting up R1 message handler: ${handlerError.message}`, 'error')
        }

        // Set up TTS response handlers
        try {
          // Handle TTS responses from messaging API (for speakText)
          if (r1.messaging && typeof r1.messaging.onSpeech === 'function') {
            r1.messaging.onSpeech((audioData, metadata) => {
              addConsoleLog(`🎵 R1 messaging onSpeech received: ${!!audioData} bytes`)

              if (socketRef.current && socketRef.current.connected) {
                const currentDeviceId = socketRef.current._deviceId
                const ttsResponseData = {
                  requestId: socketRef.current._pendingTTSRequestId,
                  audioData: typeof audioData === 'string' ? audioData : Buffer.from(audioData).toString('base64'),
                  audioFormat: metadata?.format || socketRef.current._ttsSettings?.responseFormat || 'mp3',
                  model: metadata?.model || socketRef.current._ttsSettings?.model || 'tts-1',
                  voice: metadata?.voice || socketRef.current._ttsSettings?.voice || 'alloy',
                  speed: metadata?.speed || socketRef.current._ttsSettings?.speed || 1,
                  timestamp: new Date().toISOString(),
                  deviceId: currentDeviceId
                }

                addConsoleLog(`📤 Sending messaging TTS response data: ${JSON.stringify(ttsResponseData, null, 2)}`)
                socketRef.current.emit('tts_response', ttsResponseData)
                addConsoleLog(`✅ Sent R1 messaging TTS response via socket (requestId: ${socketRef.current._pendingTTSRequestId})`)

                // Clear the pending TTS request data
                socketRef.current._pendingTTSRequestId = null
                socketRef.current._ttsSettings = null
              } else {
                addConsoleLog('Socket not connected, cannot send TTS response', 'error')
              }
            })
            addConsoleLog('✅ R1 messaging onSpeech handler set up', 'info')
          }

          // Handle TTS responses from LLM API (for textToSpeech and askLLMSpeak)
          if (r1.llm && typeof r1.llm.onSpeech === 'function') {
            r1.llm.onSpeech((audioData, metadata) => {
              addConsoleLog(`🎵 R1 LLM onSpeech received: ${!!audioData} bytes`)

              if (socketRef.current && socketRef.current.connected) {
                const currentDeviceId = socketRef.current._deviceId
                const ttsResponseData = {
                  requestId: socketRef.current._pendingTTSRequestId,
                  audioData: typeof audioData === 'string' ? audioData : Buffer.from(audioData).toString('base64'),
                  audioFormat: metadata?.format || socketRef.current._ttsSettings?.responseFormat || 'mp3',
                  model: metadata?.model || socketRef.current._ttsSettings?.model || 'tts-1',
                  voice: metadata?.voice || socketRef.current._ttsSettings?.voice || 'alloy',
                  speed: metadata?.speed || socketRef.current._ttsSettings?.speed || 1,
                  timestamp: new Date().toISOString(),
                  deviceId: currentDeviceId
                }

                addConsoleLog(`📤 Sending LLM TTS response data: ${JSON.stringify(ttsResponseData, null, 2)}`)
                socketRef.current.emit('tts_response', ttsResponseData)
                addConsoleLog(`✅ Sent R1 LLM TTS response via socket (requestId: ${socketRef.current._pendingTTSRequestId})`)

                // Clear the pending TTS request data
                socketRef.current._pendingTTSRequestId = null
                socketRef.current._ttsSettings = null
              } else {
                addConsoleLog('Socket not connected, cannot send TTS response', 'error')
              }
            })
            addConsoleLog('✅ R1 LLM onSpeech handler set up', 'info')
          }

          // Generic TTS event handler (fallback)
          if (r1.tts && typeof r1.tts.onSpeech === 'function') {
            r1.tts.onSpeech((audioData, metadata) => {
              addConsoleLog(`🎵 R1 TTS onSpeech received: ${!!audioData} bytes`)

              if (socketRef.current && socketRef.current.connected) {
                const currentDeviceId = socketRef.current._deviceId
                const ttsResponseData = {
                  requestId: socketRef.current._pendingTTSRequestId,
                  audioData: typeof audioData === 'string' ? audioData : Buffer.from(audioData).toString('base64'),
                  audioFormat: metadata?.format || socketRef.current._ttsSettings?.responseFormat || 'mp3',
                  model: metadata?.model || socketRef.current._ttsSettings?.model || 'tts-1',
                  voice: metadata?.voice || socketRef.current._ttsSettings?.voice || 'alloy',
                  speed: metadata?.speed || socketRef.current._ttsSettings?.speed || 1,
                  timestamp: new Date().toISOString(),
                  deviceId: currentDeviceId
                }

                addConsoleLog(`📤 Sending TTS response data: ${JSON.stringify(ttsResponseData, null, 2)}`)
                socketRef.current.emit('tts_response', ttsResponseData)
                addConsoleLog(`✅ Sent R1 TTS response via socket (requestId: ${socketRef.current._pendingTTSRequestId})`)

                // Clear the pending TTS request data
                socketRef.current._pendingTTSRequestId = null
                socketRef.current._ttsSettings = null
              } else {
                addConsoleLog('Socket not connected, cannot send TTS response', 'error')
              }
            })
            addConsoleLog('✅ R1 TTS onSpeech handler set up', 'info')
          }
        } catch (ttsHandlerError) {
          addConsoleLog(`❌ Error setting up R1 TTS handlers: ${ttsHandlerError.message}`, 'error')
        }
      } else {
        addConsoleLog('❌ R1 SDK messaging not available - this app must run on R1 device', 'error')
        addConsoleLog(`🔍 r1 object details: ${JSON.stringify(r1, null, 2)}`, 'info')

        // Check if we're in a browser environment that doesn't have R1 SDK
        if (typeof window !== 'undefined' && !window.r1) {
          addConsoleLog('💡 This appears to be running in a browser without R1 SDK', 'info')
          addConsoleLog('💡 For testing, you can use the mock response mode', 'info')
        }
      }
    } catch (error) {
      addConsoleLog(`❌ R1 SDK initialization error: ${error.message}`, 'error')
      addConsoleLog(`❌ Error stack: ${error.stack}`, 'error')
      console.error('R1 SDK initialization error details:', error)
    }

    // Set up global handlers for socket hook
    window.handleChatCompletion = handleChatCompletion
    window.handleTextToSpeech = handleTextToSpeech

    // Cleanup
    return () => {
      if (window.handleChatCompletion) {
        delete window.handleChatCompletion
      }
      if (window.handleTextToSpeech) {
        delete window.handleTextToSpeech
      }
    }
  }, [addConsoleLog, sendErrorToServer, socketRef])

  return {
    r1CreateRef
  }
}