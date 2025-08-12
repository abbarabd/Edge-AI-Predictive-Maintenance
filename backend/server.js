const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const mqttService = require('./services/mqttService');
const supabaseService = require('./services/supabaseService');
const motorRoutes = require('./routes/motors');
const anomalyRoutes = require('./routes/anomalies');
const rawDataRoutes = require('./routes/rawData');
const predictionRoutes = require('./routes/predictions');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/motors', motorRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/raw-data', rawDataRoutes);
app.use('/api/predictions', predictionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Global WebSocket instance for other modules
global.io = io;

// Initialize services
async function initializeServices() {
  try {
    await supabaseService.initializeDatabase();
    console.log('✅ Database initialized');
    
    await mqttService.connect();
    console.log('✅ MQTT service connected');
    
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Start server
server.listen(PORT, async () => {
  console.log(` Server running on port ${PORT}`);
  console.log(` Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  
  await initializeServices();
});