import React, { useState } from 'react';

const DeviceLogin = ({
    deviceId,
    pinCode,
    onDeviceIdChange,
    onPinCodeChange,
    onLogin,
    error
}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        await onLogin(deviceId, pinCode);
        setIsLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>R1 Control Panel</h1>
                    <p>Connect to your R1 device</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="deviceId">
                            Device ID *
                        </label>
                        <input
                            id="deviceId"
                            type="text"
                            className="form-input"
                            value={deviceId}
                            onChange={(e) => onDeviceIdChange(e.target.value)}
                            placeholder="e.g., green-wolf-23"
                            required
                            disabled={isLoading}
                        />
                        <div className="form-help">
                            Your unique R1 device identifier
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="pinCode">
                            PIN Code (optional)
                        </label>
                        <input
                            id="pinCode"
                            type="password"
                            className="form-input"
                            value={pinCode}
                            onChange={(e) => onPinCodeChange(e.target.value)}
                            placeholder="6-digit PIN (if enabled)"
                            disabled={isLoading}
                        />
                        <div className="form-help">
                            Leave empty if PIN authentication is disabled
                        </div>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn login-btn"
                        disabled={isLoading || !deviceId.trim()}
                    >
                        {isLoading ? (
                            <>
                                <span className="loading"></span>
                                Connecting...
                            </>
                        ) : (
                            'Connect to Device'
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <div className="security-note">
                        <h4>🔒 Privacy & Security</h4>
                        <ul>
                            <li>Your device ID and PIN are stored locally in your browser</li>
                            <li>Only you can access your R1 device with these credentials</li>
                            <li>No device information is shared with other users</li>
                        </ul>
                    </div>

                    <div className="help-section">
                        <h4>Need Help?</h4>
                        <p>
                            Find your device ID in the R1 Anywhere app on your device.
                            The PIN is displayed when your R1 first connects to the server.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeviceLogin;