import React, { useState, useEffect } from 'react';

const Dashboard: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<string>('checking...');

  useEffect(() => {
    // Test API connection
    fetch('http://localhost:3001/health')
      .then(res => res.json())
      .then(data => setApiStatus(data.status))
      .catch(() => setApiStatus('disconnected'));
  }, []);

  return (
    <div className="page">
      <h2>Dashboard</h2>
      
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>API Status</h3>
          <p className={`status ${apiStatus}`}>{apiStatus}</p>
        </div>
        
        <div className="dashboard-card">
          <h3>Servers</h3>
          <p>0 active servers</p>
        </div>
        
        <div className="dashboard-card">
          <h3>Domains</h3>
          <p>0 domains configured</p>
        </div>
        
        <div className="dashboard-card">
          <h3>Usage</h3>
          <p>Ready to build!</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;