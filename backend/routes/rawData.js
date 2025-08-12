const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// GET /api/raw-data/:machineId - Récupérer les données brutes pour une machine
router.get('/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { limit = 1000, offset = 0, startDate, endDate } = req.query;

    let rawData = await supabaseService.getRawSensorData(
      machineId, 
      parseInt(limit), 
      parseInt(offset)
    );

    // Filtrer par date si spécifié
    if (startDate || endDate) {
      rawData = rawData.filter(record => {
        const recordDate = new Date(record.timestamp_rpi);
        if (startDate && recordDate < new Date(startDate)) return false;
        if (endDate && recordDate > new Date(endDate)) return false;
        return true;
      });
    }

    res.json(rawData);
  } catch (error) {
    console.error('Error fetching raw data:', error);
    res.status(500).json({ error: 'Failed to fetch raw sensor data' });
  }
});

// GET /api/raw-data/:machineId/processed - Données traitées pour les graphiques
router.get('/:machineId/processed', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { limit = 500 } = req.query;

    const rawData = await supabaseService.getRawSensorData(machineId, parseInt(limit));

    // Traiter les données pour les différents types de graphiques
    const processedData = {
      vibration: rawData.map(d => ({
        timestamp: d.timestamp_rpi,
        value: Math.sqrt(Math.pow(d.accel_x_g || 0, 2) + Math.pow(d.accel_y_g || 0, 2) + Math.pow(d.accel_z_g || 0, 2))
      })),
      temperature: rawData.map(d => ({
        timestamp: d.timestamp_rpi,
        value: d.temperature_c || 0
      })),
      sound: rawData.map(d => ({
        timestamp: d.timestamp_rpi,
        value: d.sound_amplitude || 0
      })),
      acceleration: {
        x: rawData.map(d => ({ timestamp: d.timestamp_rpi, value: d.accel_x_g || 0 })),
        y: rawData.map(d => ({ timestamp: d.timestamp_rpi, value: d.accel_y_g || 0 })),
        z: rawData.map(d => ({ timestamp: d.timestamp_rpi, value: d.accel_z_g || 0 }))
      }
    };

    res.json(processedData);
  } catch (error) {
    console.error('Error processing raw data:', error);
    res.status(500).json({ error: 'Failed to process raw sensor data' });
  }
});

// GET /api/raw-data/:machineId/stats - Statistiques des données brutes
router.get('/:machineId/stats', async (req, res) => {
  try {
    const { machineId } = req.params;
    const rawData = await supabaseService.getRawSensorData(machineId, 1000);

    if (rawData.length === 0) {
      return res.json({
        message: 'No data available',
        count: 0
      });
    }

    // Calculer les statistiques
    const stats = {
      count: rawData.length,
      dateRange: {
        start: rawData[rawData.length - 1].timestamp_rpi,
        end: rawData[0].timestamp_rpi
      },
      temperature: {
        min: Math.min(...rawData.map(d => d.temperature_c || 0)),
        max: Math.max(...rawData.map(d => d.temperature_c || 0)),
        avg: rawData.reduce((sum, d) => sum + (d.temperature_c || 0), 0) / rawData.length
      },
      vibration: {
        min: Math.min(...rawData.map(d => Math.sqrt(Math.pow(d.accel_x_g || 0, 2) + Math.pow(d.accel_y_g || 0, 2) + Math.pow(d.accel_z_g || 0, 2)))),
        max: Math.max(...rawData.map(d => Math.sqrt(Math.pow(d.accel_x_g || 0, 2) + Math.pow(d.accel_y_g || 0, 2) + Math.pow(d.accel_z_g || 0, 2)))),
        avg: rawData.reduce((sum, d) => sum + Math.sqrt(Math.pow(d.accel_x_g || 0, 2) + Math.pow(d.accel_y_g || 0, 2) + Math.pow(d.accel_z_g || 0, 2)), 0) / rawData.length
      },
      sound: {
        min: Math.min(...rawData.map(d => d.sound_amplitude || 0)),
        max: Math.max(...rawData.map(d => d.sound_amplitude || 0)),
        avg: rawData.reduce((sum, d) => sum + (d.sound_amplitude || 0), 0) / rawData.length
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Error calculating raw data stats:', error);
    res.status(500).json({ error: 'Failed to calculate raw data statistics' });
  }
});

module.exports = router;