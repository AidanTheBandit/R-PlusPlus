const twilio = require('twilio');

// Initialize Twilio client if credentials are available
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function setupTwilioRoutes(app, io, connectedR1s, pendingRequests, requestDeviceMap, database) {
  // Link phone number - send verification code
  app.post('/link-phone', async (req, res) => {
    const { deviceId, phoneNumber } = req.body;

    if (!deviceId || !phoneNumber) {
      return res.status(400).json({ error: 'deviceId and phoneNumber are required' });
    }

    if (!twilioClient) {
      return res.status(500).json({ error: 'Twilio not configured' });
    }

    try {
      // Check if device exists
      const device = await database.getDevice(deviceId);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Check if phone is already linked
      const existingLink = await database.getPhoneLink(phoneNumber);
      if (existingLink && existingLink.verified) {
        return res.status(400).json({ error: 'Phone number already linked to a device' });
      }

      // If phone exists but not verified, or doesn't exist, proceed with linking
      // The INSERT OR REPLACE will handle updating existing unverified links

      // Generate 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Save or update phone link
      await database.createPhoneLink(deviceId, phoneNumber, verificationCode);

      // Send SMS with verification code
      await twilioClient.messages.create({
        body: `Your R1 verification code is: ${verificationCode}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      res.json({ message: 'Verification code sent to your phone' });
    } catch (error) {
      console.error('Error linking phone:', error);
      res.status(500).json({ error: 'Failed to send verification code' });
    }
  });

  // Verify phone number
  app.post('/verify-phone', async (req, res) => {
    const { phoneNumber, verificationCode } = req.body;

    if (!phoneNumber || !verificationCode) {
      return res.status(400).json({ error: 'phoneNumber and verificationCode are required' });
    }

    try {
      const verified = await database.verifyPhoneLink(phoneNumber, verificationCode);
      if (verified) {
        res.json({ message: 'Phone number verified successfully' });
      } else {
        res.status(400).json({ error: 'Invalid verification code' });
      }
    } catch (error) {
      console.error('Error verifying phone:', error);
      res.status(500).json({ error: 'Failed to verify phone number' });
    }
  });

  // Get linked phones for a device
  app.get('/phone-links/:deviceId', async (req, res) => {
    const { deviceId } = req.params;

    try {
      const phoneLinks = await database.getPhoneLinksByDevice(deviceId);
      res.json(phoneLinks);
    } catch (error) {
      console.error('Error getting phone links:', error);
      res.status(500).json({ error: 'Failed to get phone links' });
    }
  });

  // Unlink phone number
  app.post('/unlink-phone', async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    try {
      await database.unlinkPhone(phoneNumber);
      res.json({ message: 'Phone number unlinked successfully' });
    } catch (error) {
      console.error('Error unlinking phone:', error);
      res.status(500).json({ error: 'Failed to unlink phone number' });
    }
  });
  app.post('/sms-webhook', express.urlencoded({ extended: true }), async (req, res) => {
    console.log('SMS webhook received:', { body: req.body, headers: req.headers });

    const { From: fromNumber, Body: message } = req.body;

    if (!fromNumber || !message) {
      console.error('Missing From or Body in SMS webhook:', req.body);
      return res.status(400).send('Bad Request - Missing required fields');
    }

    try {
      // Check if phone is linked and verified
      const phoneLink = await database.getPhoneLink(fromNumber);
      if (!phoneLink || !phoneLink.verified) {
        // Send response that phone is not linked
        if (twilioClient) {
          await twilioClient.messages.create({
            body: 'This phone number is not linked to any R1 device. Please link it first through the R1 control panel.',
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fromNumber
          });
        }
        return res.status(200).send('OK');
      }

      const { device_id: deviceId } = phoneLink;

      // Check if device is connected
      if (!connectedR1s.has(deviceId)) {
        if (twilioClient) {
          await twilioClient.messages.create({
            body: 'Your R1 device is not currently connected.',
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fromNumber
          });
        }
        return res.status(200).send('OK');
      }

      // Handle unlink command
      if (message.trim().toLowerCase() === '!unlink!') {
        await database.unlinkPhone(fromNumber);
        if (twilioClient) {
          await twilioClient.messages.create({
            body: 'Your phone number has been unlinked from the R1 device.',
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fromNumber
          });
        }
        return res.status(200).send('OK');
      }

      // Send message to R1
      const socket = connectedR1s.get(deviceId);
      const requestId = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save pending request
      await database.savePendingRequest(requestId, deviceId);
      pendingRequests.set(requestId, { fromNumber, timestamp: Date.now() });
      requestDeviceMap.set(requestId, deviceId);

      // Send to R1
      socket.emit('chat_completion', {
        type: 'chat_completion',
        data: {
          message: message,
          originalMessage: message,
          model: 'r1-command',
          temperature: 0.7,
          max_tokens: 150,
          requestId,
          timestamp: new Date().toISOString()
        }
      });

      // Wait for response with timeout
      const timeout = 30000; // 30 seconds
      const responsePromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout'));
        }, timeout);

        const responseHandler = (data) => {
          const { requestId: responseId, response, originalMessage, model } = data;
          if (responseId === requestId) {
            clearTimeout(timeoutId);
            socket.off('response', responseHandler);
            resolve({ response, originalMessage, model });
          }
        };

        socket.on('response', responseHandler);
      });

      try {
        const responseData = await responsePromise;

        // Mark request as completed
        await database.completePendingRequest(requestId);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);

        // Send response back via SMS
        let responseText = responseData.response || 'Sorry, I couldn\'t generate a response.';

        // Truncate if too long for SMS
        if (responseText.length > 1600) {
          responseText = responseText.substring(0, 1597) + '...';
        }

        if (twilioClient) {
          await twilioClient.messages.create({
            body: responseText,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fromNumber
          });
        }

        // Save conversation
        const sessionId = `sms_${fromNumber}_${Date.now()}`;
        await database.saveMessage(sessionId, deviceId, 'user', message);
        await database.saveMessage(sessionId, deviceId, 'assistant', responseText);

      } catch (error) {
        console.error('Error getting response from R1:', error);

        // Clean up
        await database.completePendingRequest(requestId);
        pendingRequests.delete(requestId);
        requestDeviceMap.delete(requestId);

        // Send error message
        if (twilioClient) {
          await twilioClient.messages.create({
            body: 'Sorry, your R1 device didn\'t respond in time.',
            from: process.env.TWILIO_PHONE_NUMBER,
            to: fromNumber
          });
        }
      }

    } catch (error) {
      console.error('Error handling SMS webhook:', error);
    }

    // Always respond OK to Twilio
    res.status(200).send('OK');
  });
}

module.exports = { setupTwilioRoutes };