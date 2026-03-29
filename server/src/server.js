require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const initSocket = require('./socket');
const { getLatestData, onSensorData } = require('./serial');

const authRoutes = require('./routes/authRoutes');
const apptRoutes = require('./routes/appointmentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const patientNoteRoutes = require('./routes/patientNoteRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
// Increase body size limit for file uploads (base64 encoded files can be large)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const corsOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin }));

// HTTP + Socket.IO
const server = http.createServer(app);
const { io, setLatestVitals } = initSocket(server, '*'); // Allow all origins explicitly

// expose io to routes
app.use((req, _res, next) => { req.io = io; next(); });

// Live sensor endpoint for dashboard polling
app.get('/sensor-data', (_req, res) => {
  res.json(getLatestData());
});

app.get('/api/sensor-data', (_req, res) => {
  res.json(getLatestData());
});

// Relay serial updates to connected dashboard clients
onSensorData((sample) => {
  const vitals = {
    temperature: sample.temp,
    bpm: sample.bpm,
    status: sample.bpm > 120 || sample.temp > 30 ? 'ALERT' : 'NORMAL',
  };
  setLatestVitals(vitals);
  io.emit('vitalsUpdate', vitals);
});

// Handle ESP32 Data
app.post('/data', (req, res) => {
  const { temperature, bpm, status } = req.body;
  
  if (temperature && bpm) {
    const vitals = { temperature, bpm, status: status || 'NORMAL' };
    setLatestVitals(vitals);
    io.emit('vitalsUpdate', vitals);
    console.log('📡 Live ESP32 Data:', vitals);
  }
  
  res.status(200).json({ success: true, received: true });
});

app.get('/', (_req, res) => res.send('API OK'));

app.use('/api/auth', authRoutes);
app.use('/api/appointments', apptRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/patient-notes', patientNoteRoutes);
app.use('/api/notifications', notificationRoutes);

// DB + start
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
});
