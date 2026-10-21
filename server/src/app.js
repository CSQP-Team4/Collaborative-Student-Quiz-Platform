
const express = require('express');
const cors = require('cors');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());

// Register API routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);

module.exports = app;
