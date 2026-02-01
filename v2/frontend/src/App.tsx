import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="header">
        <h1>Sneaky Hosting V2</h1>
        <nav>
          <a href="/">Home</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </header>
      
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;