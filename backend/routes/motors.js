const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// GET /api/motors - Récupérer tous les moteurs
router.get('/', async (req, res) => {
  try {
    const motors = await supabaseService.getMotors();
    
    // Enrichir avec les données récentes
    const enrichedMotors = await Promise.all(
      motors.map(async (motor) => {
        try {
          // Récupérer les anomalies récentes
          const anomalies = await supabaseService.getAnomalies(motor.id, 10);
          
          // Récupérer la dernière prédiction
          const latestPrediction = await supabaseService.getLatestPrediction(motor.id);
          
          // Récupérer quelques données brutes récentes pour les graphiques
          const rawData = await supabaseService.getRawSensorData(motor.id, 100);
          
          return {
            ...motor,
            anomalies: anomalies || [],
            latestPrediction: latestPrediction || null,
            vibrationData: rawData?.map(d => ({ 
              timestamp: d.timestamp_rpi, 
              value: Math.sqrt(Math.pow(d.accel_x_g || 0, 2) + Math.pow(d.accel_y_g || 0, 2) + Math.pow(d.accel_z_g || 0, 2))
            })) || [],
            temperatureData: rawData?.map(d => ({ 
              timestamp: d.timestamp_rpi, 
              value: d.temperature_c || 0 
            })) || [],
            soundData: rawData?.map(d => ({ 
              timestamp: d.timestamp_rpi, 
              value: d.sound_amplitude || 0 
            })) || [],
            rawSensorData: rawData || []
          };
        } catch (error) {
          console.error(`Error enriching motor ${motor.id}:`, error);
          return {
            ...motor,
            anomalies: [],
            latestPrediction: null,
            vibrationData: [],
            temperatureData: [],
            soundData: [],
            rawSensorData: []
          };
        }
      })
    );

    res.json(enrichedMotors);
  } catch (error) {
    console.error('Error fetching motors:', error);
    res.status(500).json({ error: 'Failed to fetch motors' });
  }
});

// GET /api/motors/:id - Récupérer un moteur spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const motor = await supabaseService.getMotorById(id);
    
    if (!motor) {
      return res.status(404).json({ error: 'Motor not found' });
    }

    // Enrichir avec les données récentes
    const anomalies = await supabaseService.getAnomalies(id, 50);
    const latestPrediction = await supabaseService.getLatestPrediction(id);
    const rawData = await supabaseService.getRawSensorData(id, 500);

    const enrichedMotor = {
      ...motor,
      anomalies: anomalies || [],
      latestPrediction: latestPrediction || null,
      vibrationData: rawData?.map(d => ({ 
        timestamp: d.timestamp_rpi, 
        value: Math.sqrt(Math.pow(d.accel_x_g || 0, 2) + Math.pow(d.accel_y_g || 0, 2) + Math.pow(d.accel_z_g || 0, 2))
      })) || [],
      temperatureData: rawData?.map(d => ({ 
        timestamp: d.timestamp_rpi, 
        value: d.temperature_c || 0 
      })) || [],
      soundData: rawData?.map(d => ({ 
        timestamp: d.timestamp_rpi, 
        value: d.sound_amplitude || 0 
      })) || [],
      rawSensorData: rawData || []
    };

    res.json(enrichedMotor);
  } catch (error) {
    console.error('Error fetching motor:', error);
    res.status(500).json({ error: 'Failed to fetch motor' });
  }
});

// PUT /api/motors/:id/status - Mettre à jour le statut d'un moteur
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, overall_severity } = req.body;

    await supabaseService.updateMotorStatus(id, {
      status,
      overall_severity,
      last_updated: new Date().toISOString()
    });

    // Émettre la mise à jour via WebSocket
    if (global.io) {
      global.io.emit('motorStatusUpdate', {
        machineId: id,
        status,
        overall_severity
      });
    }

    res.json({ message: 'Motor status updated successfully' });
  } catch (error) {
    console.error('Error updating motor status:', error);
    res.status(500).json({ error: 'Failed to update motor status' });
  }
});

module.exports = router;