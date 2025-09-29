import React, { useState, useEffect } from 'react';

const PhoneLink = ({ deviceId }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [linkedPhones, setLinkedPhones] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [showVerification, setShowVerification] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [phoneToUnlink, setPhoneToUnlink] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsentDetails, setShowConsentDetails] = useState(false);

  useEffect(() => {
    loadLinkedPhones();
  }, [deviceId]);

  const loadLinkedPhones = async () => {
    try {
      const response = await fetch(`/phone-links/${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setLinkedPhones(data);
      }
    } catch (error) {
      console.error('Error loading linked phones:', error);
    }
  };

  const handleLinkPhone = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/link-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId,
          phoneNumber,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Verification code sent to your phone!');
        setMessageType('success');
        setShowVerification(true);
      } else {
        setMessage(data.error || 'Failed to send verification code');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhone = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          verificationCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Phone number linked successfully!');
        setMessageType('success');
        setPhoneNumber('');
        setVerificationCode('');
        setShowVerification(false);
        loadLinkedPhones();
      } else {
        setMessage(data.error || 'Invalid verification code');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkPhone = (phoneNum) => {
    setPhoneToUnlink(phoneNum);
    setShowUnlinkConfirm(true);
  };

  const confirmUnlinkPhone = async () => {
    const phoneNum = phoneToUnlink;
    setShowUnlinkConfirm(false);
    setPhoneToUnlink('');

    try {
      const response = await fetch('/unlink-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNum,
        }),
      });

      if (response.ok) {
        setMessage('Phone number unlinked successfully!');
        setMessageType('success');
        loadLinkedPhones();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to unlink phone');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
      setMessageType('error');
    }
  };

  const cancelUnlink = () => {
    setShowUnlinkConfirm(false);
    setPhoneToUnlink('');
  };

  const formatPhoneNumber = (phone) => {
    // Basic US phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="phone-link">
      <div className="card">
        <h2>📱 SMS Integration</h2>
        <p>Link your phone number to receive SMS notifications and control your R1 via text messages.</p>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        {showUnlinkConfirm && (
          <div className="confirm-dialog">
            <div className="confirm-content">
              <h3>Confirm Unlink</h3>
              <p>Are you sure you want to unlink {formatPhoneNumber(phoneToUnlink)}?</p>
              <div className="confirm-buttons">
                <button onClick={confirmUnlinkPhone} className="btn btn-danger">
                  Unlink
                </button>
                <button onClick={cancelUnlink} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {!showVerification ? (
          <div className="opt-in-section">
            <div className="consent-notice">
              <h3>📱 SMS Messaging Consent</h3>
              <p>By linking your phone number, you consent to receive SMS messages from R1 for device control and notifications.</p>
              
              <div className="consent-details">
                <strong>What you'll receive:</strong>
                <ul>
                  <li>Verification codes for phone linking</li>
                  <li>Responses to your R1 device commands</li>
                  <li>Device status notifications (rare)</li>
                </ul>
                
                <strong>Message frequency:</strong>
                <ul>
                  <li>Verification: Only when you request phone linking</li>
                  <li>Commands: Only when you send messages to your R1</li>
                  <li>Notifications: Less than 10 messages per month</li>
                </ul>
                
                <strong>Standard rates may apply.</strong> You can opt-out at any time by texting <code>!unlink!</code> or using the unlink button below.
              </div>
              
              <div className="privacy-links">
                <a href="#" onClick={(e) => { e.preventDefault(); setShowConsentDetails(!showConsentDetails); }}>
                  {showConsentDetails ? 'Hide' : 'Show'} detailed consent information
                </a>
              </div>
              
              {showConsentDetails && (
                <div className="consent-expanded">
                  <h4>Privacy & Consent Details</h4>
                  <p>Your phone number will be stored securely and used only for R1 device communication. We comply with SMS regulations and require explicit consent for messaging.</p>
                  <p><strong>Data Collection:</strong> Phone number, message timestamps, and device association</p>
                  <p><strong>Data Usage:</strong> SMS delivery for device control and verification</p>
                  <p><strong>Data Retention:</strong> Phone links are retained until you unlink them</p>
                  <p><strong>Opt-out:</strong> Text "!unlink!" to your linked number or use the unlink button</p>
                  <p>For more information, see our <a href="#" target="_blank">Privacy Policy</a> and <a href="#" target="_blank">Terms of Service</a>.</p>
                </div>
              )}
            </div>
            
            <form onSubmit={handleLinkPhone} className="link-form">
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number:</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  required
                  pattern="^\+?[1-9]\d{1,14}$"
                  title="Please enter a valid phone number (e.g., +1234567890)"
                />
                <small>Include country code (e.g., +1 for US)</small>
              </div>
              
              <div className="consent-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    required
                  />
                  <span className="checkmark"></span>
                  I consent to receive SMS messages from R1 for device control and notifications. I understand I can opt-out at any time.
                </label>
              </div>
              
              <button type="submit" disabled={isLoading || !consentGiven} className="btn">
                {isLoading ? 'Sending...' : 'Send Verification Code'}
              </button>
              
              {!consentGiven && (
                <small className="consent-required">Please check the consent box to continue</small>
              )}
            </form>
          </div>
        ) : (
          <form onSubmit={handleVerifyPhone} className="verify-form">
            <div className="form-group">
              <label htmlFor="verificationCode">Verification Code:</label>
              <input
                type="text"
                id="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                pattern="\d{6}"
                maxLength="6"
              />
              <small>Check your SMS for the 6-digit verification code</small>
            </div>
            <div className="button-group">
              <button type="submit" disabled={isLoading} className="btn">
                {isLoading ? 'Verifying...' : 'Verify & Link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVerification(false);
                  setVerificationCode('');
                  setMessage('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="linked-phones">
          <h3>Linked Phone Numbers</h3>
          {linkedPhones.length === 0 ? (
            <p>No phone numbers linked yet.</p>
          ) : (
            <div className="phone-list">
              {linkedPhones.map((link) => (
                <div key={link.id} className="phone-item">
                  <span className="phone-number">{formatPhoneNumber(link.phone_number)}</span>
                  <span className="verified-status">
                    {link.verified ? '✅ Verified' : '⏳ Pending'}
                  </span>
                  <button
                    onClick={() => handleUnlinkPhone(link.phone_number)}
                    className="btn btn-danger btn-small"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="instructions">
          <h3>How SMS Integration Works:</h3>
          <ol>
            <li>Review the consent information above and check the consent box</li>
            <li>Enter your phone number and click "Send Verification Code"</li>
            <li>Check your SMS for a 6-digit verification code</li>
            <li>Enter the code to verify and link your phone</li>
            <li>Send text messages to control your R1 device</li>
          </ol>
          
          <div className="opt-out-info">
            <h4>🔄 Managing Your Consent</h4>
            <p><strong>To opt-out/stop receiving messages:</strong></p>
            <ul>
              <li>Text <code>!unlink!</code> to your linked number</li>
              <li>Use the "Unlink" button next to your phone number below</li>
              <li>Contact support if you need assistance</li>
            </ul>
            <p>Once unlinked, you won't receive any more messages from R1.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneLink;