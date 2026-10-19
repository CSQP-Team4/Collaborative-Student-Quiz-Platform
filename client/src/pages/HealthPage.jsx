import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';

// API health check page (from CSQP-1), moved out of App.jsx unchanged in behaviour.
export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/health')
      .then((response) => setHealth(response.data))
      .catch(() => setError('Unable to connect to the API.'));
  }, []);

  return (
    <main className="simple-page">
      <h1>API Health Check</h1>

      {error && <p role="alert">{error}</p>}

      {!health && !error && <p role="status">Checking API status...</p>}

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
