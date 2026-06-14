import React, { useState } from 'react';
import QRCode from 'qrcode.react';

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
                    <p className="login-title">R1 Control Panel</p>
                    <p className="login-subtitle">Enter your device credentials to continue</p>
                </div>

                <div className="login-body">
                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="login-field">
                            <input
                                id="deviceId"
                                type="text"
                                className="login-input"
                                value={deviceId}
                                onChange={(e) => onDeviceIdChange(e.target.value)}
                                placeholder="Device ID"
                                autoComplete="username"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="login-field">
                            <input
                                id="pinCode"
                                type="password"
                                className="login-input"
                                value={pinCode}
                                onChange={(e) => onPinCodeChange(e.target.value)}
                                placeholder="PIN (optional)"
                                autoComplete="current-password"
                                disabled={isLoading}
                            />
                        </div>

                        {error && (
                            <div className="login-error">{error}</div>
                        )}

                        <button
                            type="submit"
                            className="login-btn"
                            disabled={isLoading || !deviceId.trim()}
                        >
                            {isLoading ? 'Connecting...' : 'Connect'}
                        </button>
                    </form>

                    <div className="login-qr-section">
                        <h4>Add R1 Creation to R1</h4>
                        <QRCode
                            value={JSON.stringify({
                                title: "R1 Anywhere",
                                url: "https://r1a.boondit.site/creation",
                                description: "Use R1 anywhere",
                                iconUrl: "https://boondit.site/icons/r1a.png",
                                themeColor: "#FE5F00"
                            })}
                            size={400}
                            fgColor="#FFFFFF"
                            bgColor="#111111"
                            level="M"
                        />
                    </div>
                </div>

                <div className="login-privacy">
                    Credentials are stored locally in your browser only.
                </div>
            </div>
        </div>
    );
};

export default DeviceLogin;
