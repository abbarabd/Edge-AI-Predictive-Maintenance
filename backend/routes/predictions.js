const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');

// GET /api/predictions - Récupérer toutes les prédictions
router.get('/', async (req, res) => {
  try {
    const { machineId, limit = 100 } = req.query;
    const predictions = await supabaseService.getPredictions(machineId, parseInt(limit));
    res.json(predictions);
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// GET /api/predictions/latest/:machineId - Dernière prédiction pour une machine
router.get('/latest/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const prediction = await supabaseService.getLatestPrediction(machineId);
    
    if (!prediction) {
      return res.status(404).json({ error: 'No predictions found for this machine' });
    }

    res.json(prediction);
  } catch (error) {
    console.error('Error fetching latest prediction:', error);
    res.status(500).json({ error: 'Failed to fetch latest prediction' });
  }
});

// GET /api/predictions/stats - Statistiques des prédictions
router.get('/stats', async (req, res) => {
  try {
    const { machineId } = req.query;
    const predictions = await supabaseService.getPredictions(machineId, 1000);

    // Calculer les statistiques
    const stats = {
      total: predictions.length,
      byType: {},
      bySeverity: {
        critical: predictions.filter(p => p.severity === 'critical').length,
        elevated: predictions.filter(p => p.severity === 'elevated').length,
        warning: predictions.filter(p => p.severity === 'warning').length,
        normal: predictions.filter(p => p.severity === 'normal').length
      },
      averageConfidence: {
        xgb: 0,
        dl: 0,
        overall: 0
      },
      recent: predictions.filter(p => {
        const predictionDate = new Date(p.timestamp);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return predictionDate > oneHourAgo;
      }).length
    };

    // Compter par type de prédiction
    predictions.forEach(prediction => {
      stats.byType[prediction.prediction_type] = (stats.byType[prediction.prediction_type] || 0) + 1;
    });

    // Calculer les confiances moyennes
    if (predictions.length > 0) {
      const validPredictions = predictions.filter(p => p.xgb_confidence && p.dl_confidence);
      if (validPredictions.length > 0) {
        stats.averageConfidence.xgb = validPredictions.reduce((sum, p) => sum + p.xgb_confidence, 0) / validPredictions.length;
        stats.averageConfidence.dl = validPredictions.reduce((sum, p) => sum + p.dl_confidence, 0) / validPredictions.length;
        stats.averageConfidence.overall = validPredictions.reduce((sum, p) => sum + p.confidence, 0) / validPredictions.length;
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('Error calculating prediction stats:', error);
    res.status(500).json({ error: 'Failed to calculate prediction statistics' });
  }
});

module.exports = router;