const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1
      ? 'connected'
      : 'disconnected',
    memoryUsage: {
      rss: memoryUsage.rss,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
    },
  });
});

module.exports = router;
