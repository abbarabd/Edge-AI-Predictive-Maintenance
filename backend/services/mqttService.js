// mqttService.js
const mqtt = require('mqtt');
const supabaseService = require('./supabaseService');
const EventEmitter = require('events');

class MQTTService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this._connected = false; // Renommé pour éviter le conflit avec la méthode
    this.brokerUrl = `mqtt://${process.env.MQTT_BROKER || '127.0.0.1'}:${process.env.MQTT_PORT || 1883}`;

    this.topics = {
      motorData: 'sensor/+/data',
      motorAlerts: 'prediction/+/alert',
      motorMetrics: 'metrics/+/update'
    };
  }

  // Méthode pour vérifier la connexion
  isConnected() {
    return this._connected && this.client && this.client.connected;
  }

  async connect() {
    try {
      const options = {
        keepalive: 60,
        connectTimeout: 30 * 1000,
        reconnectPeriod: 1000,
        clean: true,
      };

      if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
        options.username = process.env.MQTT_USERNAME;
        options.password = process.env.MQTT_PASSWORD;
      }

      this.client = mqtt.connect(this.brokerUrl, options);

      this.client.on('connect', () => {
        console.log('✅ Connected to MQTT broker:', this.brokerUrl);
        this._connected = true;
        this.subscribeToTopics();
      });

      this.client.on('error', (error) => {
        console.error('❌ MQTT Error:', error);
        this._connected = false;
      });

      this.client.on('offline', () => {
        console.log('📡 MQTT client offline');
        this._connected = false;
      });

      this.client.on('reconnect', () => {
        console.log('🔄 MQTT reconnecting...');
      });

      // Un seul gestionnaire de message
      this.client.on('message', this.handleMessage.bind(this));

    } catch (error) {
      console.error('❌ Failed to connect to MQTT:', error);
      throw error;
    }
  }

  async subscribe(topicsArray) {
    if (!this.client) {
      throw new Error('MQTT client not initialized');
    }

    topicsArray.forEach(topic => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📡 Subscribed to: ${topic}`);
        }
      });
    });
  }

  subscribeToTopics() {
    Object.values(this.topics).forEach(topic => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📡 Subscribed to: ${topic}`);
        }
      });
    });
  }

  // Gestionnaire de message unifié
  async handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const machineId = this.extractMachineId(topic);

      // Émettre l'événement générique pour le serveur
      this.emit('message', topic, data);

      // Traitement spécifique par type de topic
      if (topic.includes('/data')) {
        await this.handleRawSensorData(machineId, data);
      } else if (topic.includes('/alert')) {
        await this.handlePredictionAlert(machineId, data);
      } else if (topic.includes('/update')) {
        await this.handleMetricsUpdate(machineId, data);
      }

    } catch (error) {
      console.error('❌ Error handling MQTT message:', error);
    }
  }

  extractMachineId(topic) {
    const parts = topic.split('/');
    return parts[1]; // sensor/{machineId}/data ou prediction/{machineId}/alert
  }

  async handleRawSensorData(machineId, data) {
    try {
      // Enregistrer les données brutes dans la base
      const rawDataEntry = {
        machine_id: machineId,
        timestamp_rpi: data.timestamp || new Date().toISOString(),
        temperature_c: data.temperature_c,
        accel_x_g: data.accel_x_g,
        accel_y_g: data.accel_y_g,
        accel_z_g: data.accel_z_g,
        raw_sound_analog: data.raw_sound_analog,
        sound_amplitude: data.sound_amplitude
      };

      await supabaseService.insertRawSensorData(rawDataEntry);

      // Émettre en temps réel vers le frontend
      if (global.io) {
        global.io.emit('rawSensorData', {
          machineId,
          data: rawDataEntry
        });
      }

      // Mettre à jour les métriques en temps réel
      await this.updateRealTimeMetrics(machineId, data);

    } catch (error) {
      console.error('❌ Error handling raw sensor data:', error);
    }
  }

  async handlePredictionAlert(machineId, alertData) {
    try {
      console.log(`🔮 Prédiction reçue pour ${machineId}:`, alertData);

      const predictionForFrontend = {
        id: `${Date.now()}-${machineId}`,
        machine_id: machineId,
        prediction_type: alertData.type,
        confidence: alertData.details?.xgb_confidence || 0,
        severity: alertData.severity,
        timestamp: alertData.timestamp,
        xgb_prediction: alertData.details?.xgb_prediction,
        xgb_confidence: alertData.details?.xgb_confidence,
        dl_prediction: alertData.details?.dl_prediction,
        dl_confidence: alertData.details?.dl_confidence,
        raw_data_sample: alertData.details?.raw_data_sample
      };

      // Créer l'anomalie si ce n'est pas "Normal"
      if (alertData.type !== 'Normal') {
        const anomaly = {
          machine_id: machineId,
          type: this.mapAnomalyType(alertData.type),
          severity: alertData.severity,
          description: alertData.message,
          detected_at: alertData.timestamp,
          value: alertData.details?.raw_data_sample?.temperature_c || 0,
          threshold: this.getThresholdForType(alertData.type),
          prediction_confidence: alertData.details?.xgb_confidence || 0,
          ml_details: alertData.details
        };

        const { data: insertedAnomaly } = await supabaseService.insertAnomaly(anomaly);
        
        // Émettre l'anomalie avec son ID de BDD
        if (global.io) {
          global.io.emit('new-anomaly', {
            motorId: machineId,
            anomaly: insertedAnomaly
          });
        }
      }

      // Enregistrer la prédiction en base
      const { data: insertedPrediction } = await supabaseService.insertPrediction({
        machine_id: machineId,
        prediction_type: alertData.type,
        confidence: alertData.details?.xgb_confidence || 0,
        severity: alertData.severity,
        timestamp: alertData.timestamp,
        xgb_prediction: alertData.details?.xgb_prediction,
        xgb_confidence: alertData.details?.xgb_confidence,
        dl_prediction: alertData.details?.dl_prediction,
        dl_confidence: alertData.details?.dl_confidence,
        raw_data_sample: alertData.details?.raw_data_sample
      });

      // Émettre en temps réel vers le frontend
      if (global.io) {
        console.log('📤 Émission new-prediction:', predictionForFrontend);
        global.io.emit('new-prediction', insertedPrediction);
      }

      // Mettre à jour le statut du moteur
      await this.updateMotorStatus(machineId, alertData);

    } catch (error) {
      console.error('❌ Error handling prediction alert:', error);
    }
  }

  async handleMetricsUpdate(machineId, metricsData) {
    try {
      console.log(`📈 Métriques reçues pour ${machineId}:`, metricsData);

      // Calculer les métriques en temps réel
      const metrics = {
        vibration_current: metricsData.vibration_current || 0,
        temperature_current: metricsData.temperature_current || 0,
        sound_current: metricsData.sound_current || 0,
        last_updated: new Date().toISOString(),
        ...metricsData
      };

      await supabaseService.updateMotorMetrics(machineId, metrics);

      // Émettre les métriques mises à jour
      if (global.io) {
        global.io.emit('metricsUpdate', {
          machineId,
          metrics
        });
      }

    } catch (error) {
      console.error('❌ Error handling metrics update:', error);
    }
  }

  mapAnomalyType(predictionType) {
    const typeMapping = {
      'Bearing': 'bearing',
      'Imbalance': 'vibration',
      'Temperature': 'temperature',
      'Sound': 'sound',
      'Overheating': 'temperature',
      'Vibration': 'vibration',
      'Normal': 'normal'
    };
    return typeMapping[predictionType] || 'other';
  }

  getThresholdForType(type) {
    const thresholds = {
      'Bearing': 50,
      'Imbalance': 50,
      'Temperature': 75,
      'Sound': 60,
      'Overheating': 75,
      'Vibration': 50
    };
    return thresholds[type] || 50;
  }

  async updateRealTimeMetrics(machineId, data) {
    try {
      // Calculer les métriques en temps réel
      const metrics = {
        vibration_current: Math.sqrt(
          Math.pow(data.accel_x_g || 0, 2) + 
          Math.pow(data.accel_y_g || 0, 2) + 
          Math.pow(data.accel_z_g || 0, 2)
        ),
        temperature_current: data.temperature_c || 0,
        sound_current: data.sound_amplitude || 0,
        last_updated: new Date().toISOString()
      };

      await supabaseService.updateMotorMetrics(machineId, metrics);

      // Émettre les métriques mises à jour
      if (global.io) {
        global.io.emit('metricsUpdate', {
          machineId,
          metrics
        });
      }

    } catch (error) {
      console.error('❌ Error updating real-time metrics:', error);
    }
  }

  async updateMotorStatus(machineId, alertData) {
    try {
      let status = 'running';
      let overallSeverity = 'normal';

      if (alertData.severity === 'critical') {
        status = 'maintenance';
        overallSeverity = 'critical';
      } else if (alertData.severity === 'elevated') {
        overallSeverity = 'elevated';
      } else if (alertData.severity === 'warning') {
        overallSeverity = 'warning';
      }

      await supabaseService.updateMotorStatus(machineId, {
        status,
        overall_severity: overallSeverity,
        last_prediction: alertData.timestamp
      });

    } catch (error) {
      console.error('❌ Error updating motor status:', error);
    }
  }

  disconnect() {
    if (this.client && this._connected) {
      this.client.end();
      this._connected = false;
      console.log('📡 MQTT client disconnected');
    }
  }

  // Méthode pour publier des messages (utile pour des tests ou des réponses)
  async publish(topic, message) {
    if (!this.isConnected()) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(message), (err) => {
        if (err) {
          console.error(`❌ Failed to publish to ${topic}:`, err);
          reject(err);
        } else {
          console.log(`📤 Published to ${topic}:`, message);
          resolve();
        }
      });
    });
  }

  // Méthodes utilitaires pour les statistiques
  getConnectionInfo() {
    return {
      connected: this.isConnected(),
      brokerUrl: this.brokerUrl,
      topics: this.topics,
      clientId: this.client?.options?.clientId || null
    };
  }
}

module.exports = new MQTTService();