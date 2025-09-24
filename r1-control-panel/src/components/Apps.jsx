import React from 'react';
import QRCode from 'qrcode.react';

const Apps = () => {
  const apps = [
    {
      title: "R1 Anywhere",
      url: "https://r1a.boondit.site",
      description: "Use R1 anywhere",
      iconUrl: "https://boondit.site/icons/r1a.png",
      themeColor: "#ff61f2"
    }
  ];

  const gruvboxFg = '#ebdbb2';
  const gruvboxBg = '#282828';

  return (
    <div className="card">
      <h2>Web Apps</h2>
      <p>Access web applications and shortcuts</p>
      
      <div className="apps-grid">
        {apps.map((app, index) => (
          <div key={index} className="app-card">
            <div className="app-header">
              <img src={app.iconUrl} alt={app.title} className="app-icon" />
              <div className="app-info">
                <h3>{app.title}</h3>
                <p>{app.description}</p>
              </div>
            </div>
            
            <div className="app-qr">
              <QRCode 
                value={app.url}
                size={128}
                fgColor={gruvboxFg}
                bgColor={gruvboxBg}
                level="M"
              />
            </div>
            
            <div className="app-actions">
              <a href={app.url} target="_blank" rel="noopener noreferrer" className="btn">
                Open App
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Apps;