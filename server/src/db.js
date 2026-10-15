
const mongoose = require('mongoose');

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error('MONGODB_URI is not configured. Set it in your .env file.');
  }

  await mongoose.connect(mongoURI);
  console.log('MongoDB connected successfully');
}

module.exports = connectDB;
