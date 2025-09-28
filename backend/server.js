const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Services importés
const mqttService = require('./services/mqttService');
const supabaseService = require('./services/supabaseService');

// Routes importées
const motorRoutes = require('./routes/motors');
const anomalyRoutes = require('./routes/anomalies');
const rawDataRoutes = require('./routes/rawData');
const predictionRoutes = require('./routes/predictions');

// ===== CLASSES DE GESTION D'ERREURS ET VALIDATION =====

class DataValidator {
  static validateMotorData(data) {
    const errors = [];
    
    if (!data.machine_id || typeof data.machine_id !== 'string') {
      errors.push('machine_id est requis et doit être une chaîne');
    }
    
    if (data.temperature_c !== null && (typeof data.temperature_c !== 'number' || isNaN(data.temperature_c))) {
      errors.push('temperature_c doit être un nombre valide');
    }
    
    if (data.timestamp_rpi && isNaN(new Date(data.timestamp_rpi).getTime())) {
      errors.push('timestamp_rpi doit être une date valide');
    }
    
    return errors;
  }

  static validatePredictionData(data) {
    const errors = [];
    
    if (!data.machine_id) {
      errors.push('machine_id est requis');
    }
    
    if (!data.prediction_type) {
      errors.push('prediction_type est requis');
    }
    
    if (data.confidence !== null && (data.confidence < 0 || data.confidence > 1)) {
      errors.push('confidence doit être entre 0 et 1');
    }
    
    const validSeverities = ['normal', 'warning', 'elevated', 'critical'];
    if (data.severity && !validSeverities.includes(data.severity)) {
      errors.push('severity doit être: normal, warning, elevated, ou critical');
    }
    
    return errors;
  }

  static sanitizeNumericValue(value, precision = 4) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value)) return null;
    return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
  }
}

class ErrorHandler {
  static handleDatabaseError(error, operation) {
    console.error(`❌ Erreur base de données (${operation}):`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      timestamp: new Date().toISOString()
    });

    // Gestion spécifique des erreurs courantes
    switch (error.code) {
      case '23502': // NOT NULL violation
        return `Champ requis manquant: ${error.message}`;
      case '22P02': // Invalid input syntax
        return `Format de données invalide: ${error.message}`;
      case '23503': // Foreign key violation
        return `Référence invalide: machine non trouvée`;
      case '23505': // Unique violation
        return `Données déjà existantes`;
      default:
        return `Erreur de base de données: ${error.message}`;
    }
  }

  static isRetryableError(error) {
    const retryableCodes = ['08000', '08003', '08006', '57P01'];
    return retryableCodes.includes(error.code);
  }
}

class ConnectionManager {
  constructor() {
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async executeWithRetry(operation, operationName) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.error(`❌ Échec ${operationName} (tentative ${attempt}/${this.maxRetries}):`, error.message);
        
        if (attempt === this.maxRetries || !ErrorHandler.isRetryableError(error)) {
          throw error;
        }
        
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Nouvelle tentative dans ${delay}ms...`);
        await this.sleep(delay);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== GESTIONNAIRE D'ÉVÉNEMENTS POUR RASPBERRY PI - CORRIGÉ =====

class RaspberryPiEventHandler {
  constructor(supabaseService, io) {
    this.supabaseService = supabaseService;
    this.io = io;
    this.connectionManager = new ConnectionManager();
    this.stats = {
      successfulInserts: 0,
      failedInserts: 0,
      totalEvents: 0,
      mqttMessages: 0,
      connectedDevices: 0,
      anomaliesDetected: 0,
    };
    
    // CORRECTION: Utiliser SEULEMENT le Set pour tracker les devices
    this.connectedDevicesSet = new Set();
    
    // Initialiser les cartes pour les seuils et baseline
    this.thresholds = new Map();
    this.baselineData = new Map();
  }

  // CORRECTION: Méthode unifiée pour mettre à jour les devices connectés
  updateConnectedDevices(deviceId, status) {
    console.log(`📱 Device update: ${deviceId} -> ${status}`);
    
    if (status === 'connected' || status === 'online') {
      this.connectedDevicesSet.add(deviceId);
      console.log(`✅ Device ${deviceId} ajouté. Total: ${this.connectedDevicesSet.size}`);
    } else if (status === 'disconnected' || status === 'offline') {
      this.connectedDevicesSet.delete(deviceId);
      console.log(`❌ Device ${deviceId} supprimé. Total: ${this.connectedDevicesSet.size}`);
    }
    
    // CORRECTION: Mettre à jour le compteur dans stats
    this.stats.connectedDevices = this.connectedDevicesSet.size;
    
    // Émettre la mise à jour immédiatement
    this.emitStatsUpdate();
  }
  
  // CORRECTION: Méthode pour enregistrer une connexion device
  registerDeviceConnection(deviceId) {
    console.log(`🔴 Enregistrement device: ${deviceId}`);
    this.updateConnectedDevices(deviceId, 'connected');
  }

  // CORRECTION: Méthode pour émettre les stats mises à jour
  emitStatsUpdate() {
    const enhancedStats = {
      raspberry_pi: {
        ...this.stats,
        timestamp: new Date().toISOString(),
        connected_clients: this.io.sockets.sockets.size,
        mqtt_status: mqttService.isConnected() ? 'connected' : 'disconnected'
      }
    };
    
    console.log('📊 Stats mises à jour:', enhancedStats);
    this.io.emit('stats', enhancedStats);
  }

  // Analyser les données pour détecter les anomalies
  analyzeDataForAnomalies(data) {
    const machineId = data.machine_id;
    
    // Récupérer ou créer les seuils pour cette machine
    if (!this.thresholds.has(machineId)) {
      this.initializeThresholds(machineId);
    }
    
    const thresholds = this.thresholds.get(machineId);
    const baseline = this.baselineData.get(machineId) || { count: 0, temp_sum: 0, vib_sum: 0 };
    
    // Calculer la magnitude des vibrations
    const vibrationMagnitude = Math.sqrt(
      (data.accel_x_g || 0)**2 + 
      (data.accel_y_g || 0)**2 + 
      (data.accel_z_g || 0)**2
    );

    // Mettre à jour la baseline (moyenne mobile)
    this.updateBaseline(machineId, data.temperature_c, vibrationMagnitude);

    let anomaly = null;

    // Détection intelligente avec seuils adaptatifs
    if (data.temperature_c > thresholds.temperature.critical) {
      anomaly = {
        type: 'Overheating',
        severity: 'critical',
        message: `Surchauffe critique détectée. Température: ${data.temperature_c.toFixed(1)}°C (seuil: ${thresholds.temperature.critical}°C).`,
        details: { 
          threshold_used: thresholds.temperature.critical,
          baseline_temp: baseline.temp_avg?.toFixed(1),
          deviation: ((data.temperature_c - (baseline.temp_avg || 20)) / (baseline.temp_avg || 20) * 100).toFixed(1) + '%',
          confidence: 0.95, 
          raw_data_sample: data 
        }
      };
    } else if (data.temperature_c > thresholds.temperature.warning) {
      anomaly = {
        type: 'Temperature Alert',
        severity: 'warning',
        message: `Température élevée détectée: ${data.temperature_c.toFixed(1)}°C.`,
        details: { 
          threshold_used: thresholds.temperature.warning,
          confidence: 0.78, 
          raw_data_sample: data 
        }
      };
    } else if (vibrationMagnitude > thresholds.vibration.critical) {
      anomaly = {
        type: 'Vibration',
        severity: 'critical',
        message: `Vibration critique détectée. Magnitude: ${vibrationMagnitude.toFixed(2)}g (seuil: ${thresholds.vibration.critical}g).`,
        details: { 
          threshold_used: thresholds.vibration.critical,
          baseline_vib: baseline.vib_avg?.toFixed(2),
          confidence: 0.88, 
          raw_data_sample: data 
        }
      };
    } else if (vibrationMagnitude > thresholds.vibration.warning) {
      anomaly = {
        type: 'Vibration Alert',
        severity: 'warning',
        message: `Vibration anormale détectée. Magnitude: ${vibrationMagnitude.toFixed(2)}g.`,
        details: { 
          threshold_used: thresholds.vibration.warning,
          confidence: 0.72, 
          raw_data_sample: data 
        }
      };
    }
    
    if (anomaly) {
      this.stats.anomaliesDetected++;
      console.log(`🔍 Seuils utilisés pour ${machineId}:`, thresholds);
      return {
        machineId: data.machine_id,
        timestamp: data.timestamp_rpi,
        ...anomaly
      };
    }

    return null;
  }

  // Initialiser les seuils par machine (peut être chargé depuis la BDD)
  initializeThresholds(machineId) {
    const defaultThresholds = {
      temperature: {
        warning: 35.0,
        critical: 40.0
      },
      vibration: {
        warning: 1.2,
        critical: 1.8
      },
      sound: {
        warning: 0.8,
        critical: 1.0
      }
    };
    
    this.thresholds.set(machineId, defaultThresholds);
    console.log(`⚙️ Seuils initialisés pour ${machineId}:`, defaultThresholds);
  }

  // Mettre à jour la baseline pour l'apprentissage adaptatif
  updateBaseline(machineId, temperature, vibration) {
    let baseline = this.baselineData.get(machineId) || { 
      count: 0, temp_sum: 0, vib_sum: 0, temp_avg: 0, vib_avg: 0 
    };
    
    if (temperature !== null && temperature > 0) {
      baseline.count++;
      baseline.temp_sum += temperature;
      baseline.temp_avg = baseline.temp_sum / baseline.count;
    }
    
    if (vibration > 0) {
      baseline.vib_sum += vibration;
      baseline.vib_avg = baseline.vib_sum / baseline.count;
    }
    
    this.baselineData.set(machineId, baseline);
    
    // Adapter les seuils tous les 1000 échantillons
    if (baseline.count % 1000 === 0) {
      this.adaptThresholds(machineId, baseline);
    }
  }

  // Adapter automatiquement les seuils basés sur l'historique
  adaptThresholds(machineId, baseline) {
    const thresholds = this.thresholds.get(machineId);
    
    if (baseline.temp_avg > 0) {
      thresholds.temperature.warning = baseline.temp_avg + 5;
      thresholds.temperature.critical = baseline.temp_avg + 10;
    }
    
    if (baseline.vib_avg > 0) {
      thresholds.vibration.warning = baseline.vib_avg * 2;
      thresholds.vibration.critical = baseline.vib_avg * 3;
    }
    
    console.log(`🔄 Seuils adaptés pour ${machineId}:`, thresholds);
    this.thresholds.set(machineId, thresholds);
  }

  // Méthode pour personnaliser les seuils via API
  updateMachineThresholds(machineId, newThresholds) {
    this.thresholds.set(machineId, { ...this.thresholds.get(machineId), ...newThresholds });
    console.log(`✏️ Seuils mis à jour manuellement pour ${machineId}:`, this.thresholds.get(machineId));
  }

  async handleRawSensorData(data) {
    // CORRECTION: Incrémenter totalEvents au début
    this.stats.totalEvents++;
    console.log(`📊 Traitement données capteur - Total events: ${this.stats.totalEvents}`);
    
    const sanitizedData = await this.connectionManager.executeWithRetry(async () => {
      const errors = DataValidator.validateMotorData(data);
      if (errors.length > 0) throw new Error(`Validation échouée: ${errors.join(', ')}`);

      const sanitized = {
        machine_id: data.machine_id,
        timestamp_rpi: data.timestamp_rpi || new Date().toISOString(),
        temperature_c: DataValidator.sanitizeNumericValue(data.temperature_c, 4),
        sound_amplitude: DataValidator.sanitizeNumericValue(data.sound_amplitude, 4),
        accel_x_g: DataValidator.sanitizeNumericValue(data.accel_x_g, 6),
        accel_y_g: DataValidator.sanitizeNumericValue(data.accel_y_g, 6),
        accel_z_g: DataValidator.sanitizeNumericValue(data.accel_z_g, 6)
      };

      await this.supabaseService.insertRawSensorData(sanitized);
      
      // CORRECTION: Incrémenter successfulInserts
      this.stats.successfulInserts++;
      console.log(`✅ Insertion réussie - Total succès: ${this.stats.successfulInserts}`);
      
      this.io.emit('rawSensorData', sanitized);
      console.log(`📊 Données RPi sauvegardées: ${data.machine_id} - Temp: ${sanitized.temperature_c?.toFixed(1)}°C`);
      return sanitized;
    }, 'insertion données capteur RPi').catch(error => {
      // CORRECTION: Incrémenter failedInserts
      this.stats.failedInserts++;
      console.log(`❌ Insertion échouée - Total échecs: ${this.stats.failedInserts}`);
      
      const errorMessage = ErrorHandler.handleDatabaseError(error, 'insertion capteur RPi');
      console.error(`❌ ${errorMessage}`);
      this.io.emit('dataError', { type: 'sensor_data', machine_id: data.machine_id, error: errorMessage });
      return null;
    });

    // Le reste du traitement (analyse anomalies, etc.)
    if (!sanitizedData) return;

    const analysisResult = this.analyzeDataForAnomalies(sanitizedData);
    if (analysisResult) {
      console.log(`🧠 Analyse détectée: ${analysisResult.type} sur ${analysisResult.machineId}`);
      await this.handlePredictionAlert(analysisResult);
    }
  }

  async handlePredictionAlert(alert) {
    return this.connectionManager.executeWithRetry(async () => {
      const predictionData = {
        machine_id: alert.machineId,
        prediction_type: alert.type,
        confidence: DataValidator.sanitizeNumericValue(alert.details?.xgb_confidence, 4),
        severity: alert.severity,
        timestamp: alert.timestamp || new Date().toISOString(),
        xgb_prediction: alert.type,
        xgb_confidence: DataValidator.sanitizeNumericValue(alert.details?.xgb_confidence, 4),
        dl_prediction: alert.type,
        dl_confidence: DataValidator.sanitizeNumericValue(alert.details?.dl_confidence, 4),
        raw_data_sample: alert.details?.raw_data_sample || null
      };

      const errors = DataValidator.validatePredictionData(predictionData);
      if (errors.length > 0) throw new Error(`Validation prédiction échouée: ${errors.join(', ')}`);

      const { data: insertedPrediction } = await this.supabaseService.insertPrediction(predictionData);

      if (alert.type !== 'Normal') {
        // CORRECTION: Incrémenter anomaliesDetected
        this.stats.anomaliesDetected++;
        console.log(`🚨 Anomalie détectée - Total: ${this.stats.anomaliesDetected}`);
        
        const anomalyData = {
          machine_id: alert.machineId,
          type: this.mapAnomalyType(alert.type),
          severity: alert.severity,
          description: alert.message,
          detected_at: alert.timestamp || new Date().toISOString(),
          prediction_confidence: DataValidator.sanitizeNumericValue(alert.details?.xgb_confidence, 4),
          ml_details: alert.details
        };

        const { data: insertedAnomaly } = await this.supabaseService.insertAnomaly(anomalyData);
        this.io.emit('new-anomaly', { motorId: alert.machineId, anomaly: insertedAnomaly });
      }

      await this.supabaseService.updateMotorStatus(alert.machineId, {
        status: alert.type === 'Normal' ? 'running' : 'maintenance',
        overall_severity: alert.severity,
        last_prediction: alert.timestamp || new Date().toISOString(),
        last_updated: new Date().toISOString()
      });
      
      this.io.emit('new-prediction', insertedPrediction);
      console.log(`🤖 ✅ Prédiction RPi sauvegardée: ${alert.machineId} - ${alert.type} (${alert.severity})`);
      
    }, 'traitement prédiction RPi').catch(error => {
      const errorMessage = ErrorHandler.handleDatabaseError(error, 'traitement prédiction RPi');
      console.error(`🤖 ❌ ${errorMessage}`);
      this.io.emit('dataError', { type: 'prediction', machine_id: alert.machineId, error: errorMessage });
    });
  }

  async handleMetricsUpdate({ machineId, metrics }) {
    return this.connectionManager.executeWithRetry(async () => {
      const sanitizedMetrics = {};
      
      Object.keys(metrics).forEach(key => {
        const value = metrics[key];
        if (typeof value === 'number') {
          sanitizedMetrics[key] = DataValidator.sanitizeNumericValue(value, 4);
        } else if (value instanceof Date) {
          sanitizedMetrics[key] = value.toISOString();
        } else if (typeof value === 'string') {
          sanitizedMetrics[key] = value;
        }
      });

      sanitizedMetrics.last_updated = new Date().toISOString();

      await this.supabaseService.updateMotorMetrics(machineId, sanitizedMetrics);
      this.io.emit('metricsUpdate', { machineId, metrics: sanitizedMetrics });
      
      console.log(`📈 ✅ Métriques RPi mises à jour: ${machineId}`);
      
    }, 'mise à jour métriques RPi').catch(error => {
      const errorMessage = ErrorHandler.handleDatabaseError(error, 'mise à jour métriques RPi');
      console.error(`📈 ❌ ${errorMessage}`);
      
      this.io.emit('dataError', {
        type: 'metrics',
        machine_id: machineId,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Incrémente le compteur de messages MQTT
  handleMqttMessage() {
    this.stats.mqttMessages++;
    console.log(`📡 Message MQTT traité - Total: ${this.stats.mqttMessages}`);
  }

  // Mappe le type d'anomalie
  mapAnomalyType(type) {
    const mapping = {
      'Overheating': 'temperature',
      'Vibration': 'vibration',
      'Bearing Wear': 'bearing',
      'Electrical Fault': 'other',
      'Normal': 'other'
    };
    return mapping[type] || 'other';
  }

  // CORRECTION: Récupère les statistiques actuelles
  getStats() {
    const successRate = this.stats.totalEvents > 0 ? 
      (this.stats.successfulInserts / this.stats.totalEvents * 100).toFixed(2) + '%' : '0%';

    return {
      ...this.stats,
      successRate: successRate,
      connectedDevices: this.connectedDevicesSet.size // CORRECTION: Utiliser la taille du Set
    };
  }
}

// ===== CONFIGURATION EXPRESS =====

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

// Initialiser le gestionnaire d'événements pour Raspberry Pi
const eventHandler = new RaspberryPiEventHandler(supabaseService, io);

// Health check amélioré
app.get('/health', async (req, res) => {
  const stats = eventHandler.getStats();
  
  // Vérification de la connexion à la base de données
  let dbStatus = 'disconnected';
  try {
    await supabaseService.testConnection();
    dbStatus = 'connected';
  } catch (error) {
    console.error('DB Health check failed:', error);
  }

  // Vérification MQTT
  const mqttStatus = mqttService.isConnected() ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    mode: 'raspberry_pi',
    raspberry_pi: {
      stats: stats,
      connected_devices: stats.connectedDevices
    },
    services: {
      database: dbStatus,
      mqtt: mqttStatus
    }
  });
});

// Stats endpoint pour le monitoring
app.get('/api/stats', (req, res) => {
  const stats = eventHandler.getStats();
  res.json({
    raspberry_pi: stats,
    mqtt_status: mqttService.isConnected(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Endpoint pour recevoir des données directement des Raspberry Pi (HTTP)
app.post('/api/raspberry-pi/sensor-data', async (req, res) => {
  try {
    const sensorData = req.body;
    await eventHandler.handleRawSensorData(sensorData);
    res.json({ success: true, message: 'Données reçues et traitées' });
  } catch (error) {
    console.error('Erreur traitement données RPi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint pour recevoir des prédictions des Raspberry Pi
app.post('/api/raspberry-pi/prediction', async (req, res) => {
  try {
    const prediction = req.body;
    await eventHandler.handlePredictionAlert(prediction);
    res.json({ success: true, message: 'Prédiction reçue et traitée' });
  } catch (error) {
    console.error('Erreur traitement prédiction RPi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CORRECTION: Endpoint unique pour que les Raspberry Pi s'enregistrent
app.post('/api/raspberry-pi/connect', async (req, res) => {
  try {
    const { device_id, type, status, timestamp } = req.body;
    console.log(`🔴 Device connexion HTTP reçue: ${device_id}`);
    
    // CORRECTION: Utiliser la méthode de la classe
    eventHandler.registerDeviceConnection(device_id);
    
    // Émettre aux clients WebSocket
    io.emit('device-connected', { device_id, type, status, timestamp });
    
    const currentStats = eventHandler.getStats();
    console.log(`✅ Device ${device_id} enregistré. Stats:`, currentStats);
    
    res.json({ 
      success: true, 
      message: `Device ${device_id} enregistré`,
      stats: currentStats
    });
  } catch (error) {
    console.error('Erreur enregistrement device:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour configurer les seuils de détection d'anomalies
app.post('/api/motors/:motorId/thresholds', async (req, res) => {
  try {
    const { motorId } = req.params;
    const newThresholds = req.body;
    
    // Validation des seuils
    const validFields = ['temperature', 'vibration', 'sound'];
    const validSeverities = ['warning', 'critical'];
    
    for (const field of Object.keys(newThresholds)) {
      if (!validFields.includes(field)) {
        return res.status(400).json({ error: `Champ invalide: ${field}` });
      }
      
      for (const severity of Object.keys(newThresholds[field])) {
        if (!validSeverities.includes(severity)) {
          return res.status(400).json({ error: `Sévérité invalide: ${severity}` });
        }
        
        if (typeof newThresholds[field][severity] !== 'number') {
          return res.status(400).json({ error: `Valeur invalide pour ${field}.${severity}` });
        }
      }
    }
    
    // Mettre à jour les seuils dans le gestionnaire d'événements
    eventHandler.updateMachineThresholds(motorId, newThresholds);
    
    res.json({ 
      success: true, 
      message: `Seuils mis à jour pour ${motorId}`,
      thresholds: eventHandler.thresholds.get(motorId)
    });
    
  } catch (error) {
    console.error('Erreur mise à jour seuils:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour récupérer les seuils actuels
app.get('/api/motors/:motorId/thresholds', (req, res) => {
  try {
    const { motorId } = req.params;
    const thresholds = eventHandler.thresholds.get(motorId);
    
    if (!thresholds) {
      return res.status(404).json({ error: 'Seuils non trouvés pour cette machine' });
    }
    
    const baseline = eventHandler.baselineData.get(motorId);
    
    res.json({
      machine_id: motorId,
      thresholds: thresholds,
      baseline: baseline ? {
        temperature_avg: baseline.temp_avg?.toFixed(2),
        vibration_avg: baseline.vib_avg?.toFixed(2),
        sample_count: baseline.count
      } : null,
      last_updated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur récupération seuils:', error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les seuils globaux
app.get('/api/settings/thresholds/global', async (req, res) => {
  try {
    const globalThresholds = {
      temperature: { 
        warning: parseFloat(process.env.TEMP_WARNING_THRESHOLD) || 35, 
        critical: parseFloat(process.env.TEMP_CRITICAL_THRESHOLD) || 40 
      },
      vibration: { 
        warning: parseFloat(process.env.VIB_WARNING_THRESHOLD) || 1.2, 
        critical: parseFloat(process.env.VIB_CRITICAL_THRESHOLD) || 1.8 
      },
      sound: { 
        warning: parseFloat(process.env.SOUND_WARNING_THRESHOLD) || 0.8, 
        critical: parseFloat(process.env.SOUND_CRITICAL_THRESHOLD) || 1.0 
      }
    };
    
    res.json(globalThresholds);
  } catch (error) {
    console.error('Erreur récupération seuils globaux:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour les seuils globaux
app.post('/api/settings/thresholds/global', async (req, res) => {
  try {
    const newThresholds = req.body;
    
    // Validation basique
    const validFields = ['temperature', 'vibration', 'sound'];
    const validSeverities = ['warning', 'critical'];
    
    for (const field of Object.keys(newThresholds)) {
      if (!validFields.includes(field)) {
        return res.status(400).json({ error: `Champ invalide: ${field}` });
      }
      
      for (const severity of Object.keys(newThresholds[field])) {
        if (!validSeverities.includes(severity)) {
          return res.status(400).json({ error: `Sévérité invalide: ${severity}` });
        }
        
        const value = newThresholds[field][severity];
        if (typeof value !== 'number' || value <= 0) {
          return res.status(400).json({ error: `Valeur invalide pour ${field}.${severity}: ${value}` });
        }
      }
    }
    
    // Mettre à jour dans le gestionnaire d'événements si il existe
    if (eventHandler && eventHandler.updateGlobalThresholds) {
      eventHandler.updateGlobalThresholds(newThresholds);
    }
    
    res.json({ 
      success: true, 
      message: 'Seuils globaux mis à jour',
      thresholds: newThresholds 
    });
    
  } catch (error) {
    console.error('Erreur mise à jour seuils globaux:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour les données récentes d'un moteur
app.get('/api/raw-data/:motorId', async (req, res) => {
  try {
    const { motorId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const sort = req.query.sort || 'desc';
    
    if (limit > 1000) {
      return res.status(400).json({ error: 'Limite maximale: 1000 enregistrements' });
    }
    
    const { data, error } = await supabaseService.supabase
      .from('raw_sensor_data')
      .select('*')
      .eq('machine_id', motorId)
      .order('timestamp_rpi', { ascending: sort === 'asc' })
      .limit(limit);
    
    if (error) throw error;
    
    res.json(data || []);
  } catch (error) {
    console.error('Erreur récupération données récentes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route de test pour diagnostiquer les problèmes
app.get('/api/test/simulate-prediction', async (req, res) => {
  try {
    const machineId = req.query.machineId || 'moteur3';
    
    // Simuler une prédiction comme si elle venait du Raspberry Pi
    const simulatedPrediction = {
      machineId: machineId,
      type: 'Overheating',
      severity: 'critical',
      message: `Test de surchauffe critique détectée sur ${machineId}`,
      timestamp: new Date().toISOString(),
      details: {
        xgb_prediction: 'Overheating',
        xgb_confidence: 0.95,
        dl_prediction: 'Overheating',
        dl_confidence: 0.92,
        raw_data_sample: {
          temperature_c: 42.5,
          accel_x_g: 0.001,
          accel_y_g: 0.015,
          accel_z_g: 1.002,
          sound_amplitude: 1500
        }
      }
    };
    
    console.log('🧪 Test - Simulation prédiction:', simulatedPrediction);
    
    // Traiter comme une vraie prédiction
    await eventHandler.handlePredictionAlert(simulatedPrediction);
    
    res.json({
      success: true,
      message: 'Prédiction simulée envoyée',
      prediction: simulatedPrediction
    });
    
  } catch (error) {
    console.error('Erreur test simulation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour vérifier l'état du système
app.get('/api/test/system-status', async (req, res) => {
  try {
    const stats = eventHandler.getStats();
    const connectedClients = io.sockets.sockets.size;
    
    // Vérifier la base de données
    const motors = await supabaseService.getMotors();
    const predictions = await supabaseService.getPredictions(null, 5);
    const anomalies = await supabaseService.getAnomalies(null, 5);
    
    res.json({
      server_status: 'running',
      mqtt_status: mqttService.isConnected() ? 'connected' : 'disconnected',
      websocket_clients: connectedClients,
      raspberry_pi_stats: stats,
      database: {
        motors_count: motors?.length || 0,
        recent_predictions: predictions?.length || 0,
        recent_anomalies: anomalies?.length || 0
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur test status:', error);
    res.status(500).json({ error: error.message });
  }
});

// CORRECTION: Endpoint de test pour forcer connexion device
app.get('/api/test/connect-device/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  console.log(`🧪 Test - Connexion forcée du device: ${deviceId}`);
  
  eventHandler.registerDeviceConnection(deviceId);
  
  const stats = eventHandler.getStats();
  console.log(`🧪 Stats après connexion forcée:`, stats);
  
  res.json({
    success: true,
    message: `Device ${deviceId} connecté en test`,
    stats: stats
  });
});

// CORRECTION: Fonction unifiée pour envoyer les stats
const sendEnhancedStats = () => {
  const stats = eventHandler.getStats();
  const enhancedStats = {
    raspberry_pi: {
      ...stats,
      timestamp: new Date().toISOString(),
      connected_clients: io.sockets.sockets.size,
      mqtt_status: mqttService.isConnected() ? 'connected' : 'disconnected'
    }
  };
  
  console.log('📊 Envoi statistiques:', enhancedStats);
  io.emit('stats', enhancedStats);
};

// CORRECTION: Un seul intervalle pour les stats
const statsInterval = setInterval(sendEnhancedStats, 10000);

// ===== WEBSOCKET CORRIGÉ =====
io.on('connection', (socket) => {
  console.log('🔌 Client WebSocket connecté:', socket.id);
  
  // Envoyer les stats immédiatement
  setTimeout(() => {
    sendEnhancedStats();
  }, 1000);
  
  socket.on('raspberry-pi-connect', (data) => {
    console.log('🔴 Raspberry Pi via WebSocket:', data.device_id);
    eventHandler.registerDeviceConnection(data.device_id);
    io.emit('device-connected', data);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client WebSocket déconnecté:', socket.id);
  });
});

// Global WebSocket instance for other modules
global.io = io;

// ===== GESTIONNAIRES MQTT POUR RASPBERRY PI =====

// Configurer les gestionnaires MQTT pour recevoir les données des Raspberry Pi
if (process.env.USE_MQTT === 'true') {
  // Topics MQTT pour les données des capteurs - CORRIGÉ
  mqttService.on('sensor/+/data', async (topic, message) => {
    try {
      console.log('📊 Données capteur MQTT reçues:', {
        topic: topic,
        machineId: topic.split('/')[1]
      });
      
      const machineId = topic.split('/')[1];
      const sensorData = { ...message, machine_id: machineId };
      
      // CORRECTION: Enregistrer le device automatiquement
      eventHandler.registerDeviceConnection(machineId);
      
      await eventHandler.handleRawSensorData(sensorData);
      eventHandler.handleMqttMessage();
      
    } catch (error) {
      console.error('Erreur traitement message MQTT capteur:', error);
    }
  });

  // Topics MQTT pour les prédictions - CORRIGÉ
  mqttService.on('prediction/+/alert', async (topic, message) => {
    try {
      console.log('🔮 Prédiction MQTT reçue:', {
        topic: topic,
        machineId: topic.split('/')[1]
      });
      
      const machineId = topic.split('/')[1];
      const prediction = { ...message, machineId };
      
      await eventHandler.handlePredictionAlert(prediction);
      eventHandler.handleMqttMessage();
    } catch (error) {
      console.error('Erreur traitement message MQTT prédiction:', error);
    }
  });

  // Topics MQTT pour le statut des devices - CORRIGÉ
  mqttService.on('device/+/status', async (topic, message) => {
    try {
      console.log('📡 Statut device MQTT reçu:', {
        topic: topic,
        machineId: topic.split('/')[1],
        status: message.status
      });
      
      const machineId = topic.split('/')[1];
      
      // CORRECTION: Utiliser la méthode de la classe
      eventHandler.updateConnectedDevices(machineId, message.status);
      
      io.emit('device-status-update', {
        machine_id: machineId,
        status: message.status,
        timestamp: message.timestamp,
        details: message
      });
      
      eventHandler.handleMqttMessage();
      
    } catch (error) {
      console.error('Erreur traitement message MQTT statut:', error);
    }
  });

  // Topics MQTT pour les métriques
  mqttService.on('metrics/+/update', async (topic, message) => {
    try {
      console.log('📈 Métriques MQTT reçues:', {
        topic: topic,
        machineId: topic.split('/')[1]
      });
      
      const machineId = topic.split('/')[1];
      await eventHandler.handleMetricsUpdate({ machineId, metrics: message });
      eventHandler.handleMqttMessage();
    } catch (error) {
      console.error('Erreur traitement message MQTT métriques:', error);
    }
  });
}

// ===== INITIALISATION DES SERVICES =====

async function initializeServices() {
  try {
    console.log('🚀 Initialisation des services pour Raspberry Pi...');
    
    // Initialiser la base de données
    await supabaseService.initializeDatabase();
    console.log('✅ Base de données initialisée');
    
    // Connecter MQTT (obligatoire pour les RPi)
    if (process.env.USE_MQTT === 'true') {
      await mqttService.connect();
      console.log('✅ Service MQTT connecté pour communication RPi');
      
      // S'abonner aux topics des Raspberry Pi
      await mqttService.subscribe([
        'sensor/+/data',
        'prediction/+/alert', 
        'metrics/+/update',
        'device/+/status'
      ]);
      console.log('✅ Abonné aux topics MQTT des Raspberry Pi');
    } else {
      console.log('⚠️ MQTT désactivé - seule la communication HTTP est disponible');
    }
    
  } catch (error) {
    console.error('❌ Échec de l\'initialisation des services:', error);
    process.exit(1);
  }
}

// ===== GESTION D'ERREURS =====

app.use((err, req, res, next) => {
  const errorMessage = ErrorHandler.handleDatabaseError(err, 'route API');
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ===== ARRÊT GRACIEUX =====

function gracefulShutdown() {
  console.log('🛑 Arrêt du serveur...');
  
  // Déconnecter MQTT
  if (mqttService.isConnected()) {
    mqttService.disconnect();
    console.log('⏹️ MQTT déconnecté');
  }
  
  // Fermer le serveur
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });

  // Force l'arrêt après 10 secondes
  setTimeout(() => {
    console.log('⏰ Arrêt forcé');
    process.exit(1);
  }, 10000);
}

// CORRECTION: Nettoyage à l'arrêt
process.on('SIGTERM', () => {
  clearInterval(statsInterval);
  gracefulShutdown();
});

process.on('SIGINT', () => {
  clearInterval(statsInterval);
  gracefulShutdown();
});

// ===== DÉMARRAGE DU SERVEUR =====

server.listen(PORT, async () => {
  console.log(`🚀 Serveur Raspberry Pi en cours d'exécution sur le port ${PORT}`);
  console.log(`📊 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 MQTT: ${process.env.USE_MQTT === 'true' ? 'Activé' : 'Désactivé'}`);
  console.log(`🔴 Mode: Communication directe avec Raspberry Pi`);
  
  await initializeServices();
});

module.exports = { app, server, io, eventHandler };