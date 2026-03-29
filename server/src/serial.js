const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const preferredSerialPath = process.env.SERIAL_PORT || 'COM6';
const hasPinnedSerialPath = Boolean(process.env.SERIAL_PORT);
const serialBaudRate = Number(process.env.SERIAL_BAUD_RATE || 115200);
const reconnectDelayMs = Number(process.env.SERIAL_RECONNECT_MS || 3000);

const latestData = { temp: 0, bpm: 0, timestamp: null };
const listeners = new Set();
let currentPort = null;
let isConnecting = false;
let reconnectTimer = null;
const blockedUntil = new Map();

function getLatestData() {
  return { ...latestData };
}

function onSensorData(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(data) {
  for (const listener of listeners) {
    try {
      listener(data);
    } catch (err) {
      console.error('Sensor listener error:', err.message);
    }
  }
}

function normalizeSample(parsed) {
  const temp = Number(parsed.temp ?? parsed.temperature ?? 0);
  const bpm = Number(parsed.bpm ?? 0);

  return {
    temp: Number.isFinite(temp) ? temp : 0,
    bpm: Number.isFinite(bpm) ? bpm : 0,
    timestamp: new Date().toISOString(),
  };
}

function scorePort(port) {
  const text = `${port.path || ''} ${port.manufacturer || ''} ${port.friendlyName || ''} ${port.pnpId || ''}`.toLowerCase();
  if (text.includes('arduino')) return 10;
  if (text.includes('wch') || text.includes('ch340') || text.includes('cp210') || text.includes('silicon labs')) return 8;
  if (text.includes('usb')) return 6;
  if ((port.path || '').toUpperCase().startsWith('COM')) return 4;
  return 1;
}

async function resolveSerialPath() {
  const ports = await SerialPort.list();

  if (ports.length === 0) {
    return { path: preferredSerialPath, discovered: ports };
  }

  if (hasPinnedSerialPath) {
    return { path: preferredSerialPath, discovered: ports };
  }

  const preferred = ports.find((p) => p.path === preferredSerialPath);
  const sorted = [...ports].sort((a, b) => scorePort(b) - scorePort(a));

  if (preferred) {
    const rest = sorted.filter((p) => p.path !== preferredSerialPath);
    sorted.splice(0, sorted.length, preferred, ...rest);
  }

  const now = Date.now();
  const available = sorted.filter((p) => (blockedUntil.get(p.path) || 0) <= now);
  const best = (available[0] || sorted[0]);
  return { path: best.path, discovered: ports };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSerial();
  }, reconnectDelayMs);
}

function attachParser(port) {
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  parser.on('data', (line) => {
    try {
      const parsed = JSON.parse(String(line).trim());
      const sample = normalizeSample(parsed);
      latestData.temp = sample.temp;
      latestData.bpm = sample.bpm;
      latestData.timestamp = sample.timestamp;
      notify(getLatestData());
      console.log('Serial data:', latestData);
    } catch (_err) {
      // Ignore non-JSON lines such as startup logs.
    }
  });
}

async function connectSerial() {
  if (isConnecting) return;
  if (currentPort && currentPort.isOpen) return;
  isConnecting = true;

  try {
    const { path, discovered } = await resolveSerialPath();
    currentPort = new SerialPort({
      path,
      baudRate: serialBaudRate,
      autoOpen: false,
    });

    attachParser(currentPort);

    currentPort.on('open', () => {
      console.log(`Serial connected on ${path} @ ${serialBaudRate}`);
    });

    currentPort.on('close', () => {
      console.warn('Serial port closed. Reconnecting...');
      scheduleReconnect();
    });

    currentPort.on('error', (err) => {
      console.error('Serial port error:', err.message);
      scheduleReconnect();
    });

    currentPort.open((err) => {
      if (err) {
        console.error(`Failed to open serial port ${path}:`, err.message);
        if (!hasPinnedSerialPath) {
          const msg = String(err.message || '').toLowerCase();
          if (msg.includes('access denied') || msg.includes('busy') || msg.includes('permission')) {
            blockedUntil.set(path, Date.now() + 10000);
          }
        }
        const available = discovered.map((p) => p.path).join(', ') || 'none';
        console.log(`Available ports: ${available}`);
        scheduleReconnect();
      }
    });
  } catch (err) {
    console.error('Failed to initialize serial reader:', err.message);
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
}

connectSerial();

module.exports = { getLatestData, onSensorData };