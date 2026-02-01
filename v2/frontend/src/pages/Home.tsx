import React from 'react';

const Home: React.FC = () => {
  return (
    <div className="page">
      <h2>Welcome to Sneaky Hosting V2</h2>
      <p>Enterprise hosting platform - simplified boilerplate</p>
      
      <div className="features">
        <div className="feature-card">
          <h3>🚀 Fast Setup</h3>
          <p>Quick and easy deployment</p>
        </div>
        
        <div className="feature-card">
          <h3>🔧 Customizable</h3>
          <p>Build your features on top</p>
        </div>
        
        <div className="feature-card">
          <h3>📊 Dashboard Ready</h3>
          <p>Basic dashboard structure included</p>
        </div>
      </div>
    </div>
  );
};

export default Home;