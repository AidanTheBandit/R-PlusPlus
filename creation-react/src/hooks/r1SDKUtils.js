// Test available R1 APIs and log their status
export const testR1APIs = (r1, addConsoleLog) => {
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

  // Test microphone APIs
  try {
    addConsoleLog('🧪 Testing R1 microphone APIs...', 'info')

    if (r1.microphone) {
      addConsoleLog('✅ r1.microphone API is available', 'info')
      if (typeof r1.microphone.startRecording === 'function') {
        addConsoleLog('✅ r1.microphone.startRecording is available', 'info')
      } else {
        addConsoleLog('❌ r1.microphone.startRecording is not a function', 'error')
      }
      if (typeof r1.microphone.stopRecording === 'function') {
        addConsoleLog('✅ r1.microphone.stopRecording is available', 'info')
      } else {
        addConsoleLog('❌ r1.microphone.stopRecording is not a function', 'error')
      }
      if (typeof r1.microphone.onAudioData === 'function') {
        addConsoleLog('✅ r1.microphone.onAudioData is available', 'info')
      } else {
        addConsoleLog('❌ r1.microphone.onAudioData is not a function', 'error')
      }
    } else {
      addConsoleLog('❌ r1.microphone API is not available', 'error')
    }
  } catch (micTestError) {
    addConsoleLog(`❌ Error testing R1 microphone APIs: ${micTestError.message}`, 'error')
  }
}