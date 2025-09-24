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
            <button type="submit" disabled={isLoading} className="btn">
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
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
          <h3>How it works:</h3>
          <ol>
            <li>Enter your phone number and click "Send Verification Code"</li>
            <li>Check your SMS for a 6-digit code</li>
            <li>Enter the code to verify and link your phone</li>
            <li>Send text messages to control your R1 device</li>
            <li>Text <code>!unlink!</code> to remove the link</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default PhoneLink;