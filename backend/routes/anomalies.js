const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// GET /api/anomalies - Récupérer toutes les anomalies
router.get('/', async (req, res) => {
  try {
    const { machineId, limit = 100, severity } = req.query;
    
    let anomalies = await supabaseService.getAnomalies(machineId, parseInt(limit));
    
    // Filtrer par sévérité si spécifié
    if (severity) {
      anomalies = anomalies.filter(anomaly => anomaly.severity === severity);
    }

    res.json(anomalies);
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

// GET /api/anomalies/stats - Statistiques des anomalies
router.get('/stats', async (req, res) => {
  try {
    const { machineId } = req.query;
    const anomalies = await supabaseService.getAnomalies(machineId, 1000);

    // Calculer les statistiques
    const stats = {
      total: anomalies.length,
      bySeverity: {
        critical: anomalies.filter(a => a.severity === 'critical').length,
        elevated: anomalies.filter(a => a.severity === 'elevated').length,
        warning: anomalies.filter(a => a.severity === 'warning').length,
        normal: anomalies.filter(a => a.severity === 'normal').length
      },
      byType: {},
      recent: anomalies.filter(a => {
        const detectedDate = new Date(a.detected_at);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return detectedDate > oneDayAgo;
      }).length
    };

    // Compter par type
    anomalies.forEach(anomaly => {
      stats.byType[anomaly.type] = (stats.byType[anomaly.type] || 0) + 1;
    });

    res.json(stats);
  } catch (error) {
    console.error('Error calculating anomaly stats:', error);
    res.status(500).json({ error: 'Failed to calculate anomaly statistics' });
  }
});

// POST /api/anomalies - Créer une anomalie manuellement (pour les tests)
router.post('/', async (req, res) => {
  try {
    const anomalyData = {
      ...req.body,
      detected_at: req.body.detected_at || new Date().toISOString()
    };

    await supabaseService.insertAnomaly(anomalyData);

    // Émettre via WebSocket
    if (global.io) {
      global.io.emit('newAnomaly', {
        machineId: anomalyData.machine_id,
        anomaly: anomalyData
      });
    }

    res.status(201).json({ message: 'Anomaly created successfully' });
  } catch (error) {
    console.error('Error creating anomaly:', error);
    res.status(500).json({ error: 'Failed to create anomaly' });
  }
});

module.exports = router;