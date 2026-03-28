// Serverless-compatible Express app for Vercel
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectToDatabase = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const apptRoutes = require('./routes/appointmentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const patientNoteRoutes = require('./routes/patientNoteRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Middleware - Increase body size limit for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const corsOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// Health check
app.get('/', (_req, res) => res.json({ status: 'API OK', timestamp: new Date().toISOString() }));

// Connect to database before handling requests
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ message: 'Database connection failed (Supabase)' });
  }
});

// Mock Socket.IO middleware (Socket.IO doesn't work in serverless)
// Provide stub to prevent errors in controllers
app.use((req, res, next) => {
  req.io = {
    to: () => ({
      emit: () => console.log('Socket.IO emit called (not available in serverless)')
    })
  };
  next();
});

// Vitals Mock DB (for Arduino Demo)
let latestVitals = { temperature: 36.8, bpm: 80, status: 'NORMAL' };

app.post('/data', (req, res) => {
  const { temperature, bpm, status } = req.body;
  if(temperature && bpm) {
    latestVitals = { temperature, bpm, status: status || 'NORMAL' };
  }
  res.status(200).json({ success: true, received: true });
});

app.get('/api/vitals', (req, res) => {
  res.json(latestVitals);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', apptRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/patient-notes', patientNoteRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Export for Vercel serverless
module.exports = app;
