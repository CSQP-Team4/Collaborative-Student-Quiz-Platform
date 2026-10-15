import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import api from './api/api';
import './App.css';

function Home() {
  return (
    <main>
      <h1>Collaborative Student Quiz Platform</h1>
      <p>Welcome to CSQP.</p>
      <p>Project scaffolding is in progress.</p>
      <Link to="/health">View API health</Link>
    </main>
  );
}

function Health() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/health')
      .then((response) => setHealth(response.data))
      .catch(() => setError('Unable to connect to the API.'));
  }, []);

  return (
    <main>
      <h1>API Health Check</h1>

      {error && <p>{error}</p>}

      {!health && !error && <p>Checking API status...</p>}

      {health && (
        <>
          <p>API Status: {health.status}</p>
          <p>MongoDB: {health.mongodb}</p>
          <h2>Memory Usage</h2>
          <pre>{JSON.stringify(health.memoryUsage, null, 2)}</pre>
        </>
      )}

      <Link to="/">Back to Home</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/health" element={<Health />} />
    </Routes>
  );
}
