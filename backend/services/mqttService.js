const mqtt = require('mqtt');
const supabaseService = require('./supabaseService');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.brokerUrl = `mqtt://${process.env.MQTT_BROKER || '127.0.0.1'}:${process.env.MQTT_PORT || 1883}`;
    
    // Topics
    this.topics = {
      motorData: 'machine/+/data',      // Données brutes des capteurs
      motorAlerts: 'machine/+/alerts'   // Alertes et prédictions du RPi
    };
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
        this.isConnected = true;
        this.subscribeToTopics();
      });

      this.client.on('error', (error) => {
        console.error('❌ MQTT Error:', error);
        this.isConnected = false;
      });

      this.client.on('offline', () => {
        console.log('📡 MQTT client offline');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        console.log('🔄 MQTT reconnecting...');
      });

      this.client.on('message', this.handleMessage.bind(this));

    } catch (error) {
      console.error('❌ Failed to connect to MQTT:', error);
      throw error;
    }
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

  async handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const machineId = this.extractMachineId(topic);

      if (topic.includes('/data')) {
        await this.handleRawSensorData(machineId, data);
      } else if (topic.includes('/alerts')) {
        await this.handlePredictionAlert(machineId, data);
      }

    } catch (error) {
      console.error('❌ Error handling MQTT message:', error);
    }
  }

  extractMachineId(topic) {
    const parts = topic.split('/');
    return parts[1]; // machine/{machineId}/data ou machine/{machineId}/alerts
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

        await supabaseService.insertAnomaly(anomaly);
      }

      // Enregistrer la prédiction
      const prediction = {
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

      await supabaseService.insertPrediction(prediction);

      // Émettre en temps réel vers le frontend
      if (global.io) {
        global.io.emit('predictionUpdate', {
          machineId,
          prediction: alertData
        });

        if (alertData.type !== 'Normal') {
          global.io.emit('newAnomaly', {
            machineId,
            anomaly: alertData
          });
        }
      }

      // Mettre à jour le statut du moteur
      await this.updateMotorStatus(machineId, alertData);

    } catch (error) {
      console.error('❌ Error handling prediction alert:', error);
    }
  }

  mapAnomalyType(predictionType) {
    const typeMapping = {
      'Bearing': 'bearing',
      'Imbalance': 'vibration',
      'Temperature': 'temperature',
      'Sound': 'sound',
      'Normal': 'normal'
    };
    return typeMapping[predictionType] || 'other';
  }

  getThresholdForType(type) {
    const thresholds = {
      'Bearing': 50,
      'Imbalance': 50,
      'Temperature': 75,
      'Sound': 60
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
    if (this.client && this.isConnected) {
      this.client.end();
      this.isConnected = false;
      console.log('📡 MQTT client disconnected');
    }
  }
}

module.exports = new MQTTService();