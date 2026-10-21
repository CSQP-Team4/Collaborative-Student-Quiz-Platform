
require('dotenv').config();

const fs = require('fs');
const https = require('https');
const app = require('./app');
const connectDB = require('./db');

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const httpsMode = process.env.HTTPS_MODE;

const trustedProxyIps = (process.env.TRUSTED_PROXY_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

async function startServer() {
  try {
    // Production must explicitly choose an HTTPS deployment mode.
    if (isProduction && !['direct', 'proxy'].includes(httpsMode)) {
      throw new Error(
        'Production requires HTTPS_MODE=direct or HTTPS_MODE=proxy.'
      );
    }

    // Trust only explicitly configured proxy IPs/CIDRs.
    if (isProduction && httpsMode === 'proxy') {
      if (trustedProxyIps.length === 0) {
        throw new Error(
          'HTTPS_MODE=proxy requires TRUSTED_PROXY_IPS.'
        );
      }

      app.set('trust proxy', trustedProxyIps);
    }

    let tlsOptions;

    // Load the TLS certificate and key before connecting to the database.
    if (httpsMode === 'direct') {
      const certPath = process.env.TLS_CERT_PATH;
      const keyPath = process.env.TLS_KEY_PATH;

      if (!certPath || !keyPath) {
        throw new Error(
          'HTTPS_MODE=direct requires TLS_CERT_PATH and TLS_KEY_PATH.'
        );
      }

      tlsOptions = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        minVersion: 'TLSv1.2',
      };
    }

    await connectDB();

    if (httpsMode === 'direct') {
      // Node.js terminates HTTPS and requires TLS 1.2 or newer.
      const server = https.createServer(tlsOptions, app);

      server.listen(PORT, () => {
        console.log(`CSQP API running with HTTPS on port ${PORT}`);
      });
    } else {
      // Proxy mode expects a trusted external proxy to terminate HTTPS.
      app.listen(PORT, () => {
        console.log(`CSQP API running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
