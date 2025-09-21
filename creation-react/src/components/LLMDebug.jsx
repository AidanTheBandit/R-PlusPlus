import React, { useState, useEffect } from 'react'

const LLMDebug = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [messageHistory, setMessageHistory] = useState([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const [llmEvents, setLlmEvents] = useState([])
  const [useLLM, setUseLLM] = useState(true)

  const addLlmEvent = (type, description) => {
    const event = {
      id: Date.now(),
      type,
      description,
      timestamp: new Date().toLocaleTimeString()
    }
    setLlmEvents(prev => [event, ...prev.slice(0, 9)])

    // Stream to server
    if (socket && socket.connected) {
      fetch('/debug/stream/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          data: event,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to stream LLM event:', err))
    }
  }

  const sendMessage = async () => {
    if (!currentMessage.trim() || !r1Sdk?.messaging) {
      addLlmEvent('error', 'Messaging API not available or message is empty')
      return
    }

    const message = currentMessage.trim()
    setCurrentMessage('')
    setIsWaitingForResponse(true)

    // Add user message to history
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString()
    }
    setMessageHistory(prev => [...prev, userMessage])

    try {
      addLlmEvent('info', `Sending message: "${message.substring(0, 50)}..."`)

      // Send message via R1 SDK
      await r1Sdk.messaging.sendMessage(message, { useLLM })

      addLlmEvent('success', 'Message sent to LLM successfully')
    } catch (error) {
      addLlmEvent('error', `Failed to send message: ${error.message}`)
      setIsWaitingForResponse(false)
    }
  }

  const askLLMSpeak = async (message) => {
    if (!r1Sdk?.llm) {
      addLlmEvent('error', 'LLM API not available')
      return
    }

    try {
      addLlmEvent('info', `Asking LLM to speak: "${message}"`)
      await r1Sdk.llm.askLLMSpeak(message, true) // Save to journal
      addLlmEvent('success', 'LLM speak request sent')
    } catch (error) {
      addLlmEvent('error', `LLM speak failed: ${error.message}`)
    }
  }

  const askLLMJSON = async () => {
    if (!r1Sdk?.llm) {
      addLlmEvent('error', 'LLM API not available')
      return
    }

    const jsonPrompt = 'List 3 facts about rabbits in JSON format with keys: fact1, fact2, fact3'

    try {
      addLlmEvent('info', 'Requesting JSON response from LLM')
      await r1Sdk.llm.askLLMJSON(jsonPrompt)
      addLlmEvent('success', 'JSON request sent to LLM')
    } catch (error) {
      addLlmEvent('error', `JSON request failed: ${error.message}`)
    }
  }

  const testQuickResponses = () => {
    const testMessages = [
      'Hello',
      'What time is it?',
      'Tell me a joke',
      'What\'s the weather like?'
    ]

    testMessages.forEach((msg, index) => {
      setTimeout(() => {
        setCurrentMessage(msg)
        setTimeout(() => sendMessage(), 100)
      }, index * 2000)
    })
  }

  const clearHistory = () => {
    setMessageHistory([])
    addLlmEvent('info', 'Message history cleared')
  }

  useEffect(() => {
    if (!r1Sdk?.messaging) return

    // Set up message response handler
    const handleMessage = (response) => {
      addLlmEvent('response', `Received response: "${response.message?.substring(0, 50) || response.substring(0, 50)}..."`)

      const responseMessage = {
        id: Date.now(),
        type: 'assistant',
        content: response.message || response.content || response,
        timestamp: new Date().toLocaleTimeString()
      }
      setMessageHistory(prev => [...prev, responseMessage])
      setIsWaitingForResponse(false)
    }

    r1Sdk.messaging.onMessage(handleMessage)

    return () => {
      if (r1Sdk.messaging) {
        r1Sdk.messaging.onMessage(null) // Remove handler
      }
    }
  }, [r1Sdk])

  return (
    <div className="llm-debug">
      <h3>LLM & Messaging Debug</h3>

      {/* Message Input */}
      <div className="debug-section">
        <h4>Send Message</h4>
        <div className="message-input">
          <textarea
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            placeholder="Type a message to send to the LLM..."
            rows={2}
            disabled={!isConnected || isWaitingForResponse}
          />
          <div className="message-controls">
            <label>
              <input
                type="checkbox"
                checked={useLLM}
                onChange={(e) => setUseLLM(e.target.checked)}
              />
              Use LLM
            </label>
            <button
              className="llm-btn"
              onClick={sendMessage}
              disabled={!isConnected || !currentMessage.trim() || isWaitingForResponse}
            >
              {isWaitingForResponse ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="debug-section">
        <h4>Quick Actions</h4>
        <div className="quick-actions">
          <button
            className="llm-btn"
            onClick={() => askLLMSpeak('Hello, how are you today?')}
            disabled={!isConnected}
          >
            Ask to Speak
          </button>
          <button
            className="llm-btn"
            onClick={askLLMJSON}
            disabled={!isConnected}
          >
            Request JSON
          </button>
          <button
            className="llm-btn"
            onClick={testQuickResponses}
            disabled={!isConnected}
          >
            Test Responses
          </button>
          <button
            className="llm-btn clear"
            onClick={clearHistory}
          >
            Clear History
          </button>
        </div>
      </div>

      {/* Message History */}
      <div className="debug-section">
        <h4>Message History</h4>
        <div className="message-history">
          {messageHistory.map(message => (
            <div key={message.id} className={`message-entry message-${message.type}`}>
              <div className="message-header">
                <span className="message-type">{message.type.toUpperCase()}</span>
                <span className="message-time">[{message.timestamp}]</span>
              </div>
              <div className="message-content">{message.content}</div>
            </div>
          ))}
          {messageHistory.length === 0 && (
            <div className="no-messages">No messages yet</div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="debug-section">
        <h4>LLM Events</h4>
        <div className="event-log">
          {llmEvents.map(event => (
            <div key={event.id} className={`event-entry event-${event.type}`}>
              [{event.timestamp}] {event.description}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LLMDebug