const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async initializeDatabase() {
    try {
      // Créer les tables si elles n'existent pas
      await this.createTables();
      await this.seedInitialData();
      console.log('✅ Database tables initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    // Motors table
    const { error: motorsError } = await this.supabase.rpc('create_motors_table');
    if (motorsError && !motorsError.message.includes('already exists')) {
      console.error('Motors table creation error:', motorsError);
    }

    // Raw sensor data table
    const { error: rawDataError } = await this.supabase.rpc('create_raw_sensor_data_table');
    if (rawDataError && !rawDataError.message.includes('already exists')) {
      console.error('Raw data table creation error:', rawDataError);
    }

    // Anomalies table
    const { error: anomaliesError } = await this.supabase.rpc('create_anomalies_table');
    if (anomaliesError && !anomaliesError.message.includes('already exists')) {
      console.error('Anomalies table creation error:', anomaliesError);
    }

    // Predictions table
    const { error: predictionsError } = await this.supabase.rpc('create_predictions_table');
    if (predictionsError && !predictionsError.message.includes('already exists')) {
      console.error('Predictions table creation error:', predictionsError);
    }
  }

  async seedInitialData() {
    // Vérifier si des moteurs existent déjà
    const { data: existingMotors } = await this.supabase
      .from('motors')
      .select('id')
      .limit(1);

    if (!existingMotors || existingMotors.length === 0) {
      // Insérer des moteurs de test avec moteur3 inclus
      const { error } = await this.supabase
        .from('motors')
        .insert([
          {
            id: 'moteur1',
            name: 'Moteur Principal A',
            location: 'Ligne de production 1',
            status: 'running',
            overall_severity: 'normal',
            vibration_current: 0,
            temperature_current: 0,
            sound_current: 0,
            created_at: new Date().toISOString()
          },
          {
            id: 'moteur2',
            name: 'Moteur Auxiliaire B',
            location: 'Ligne de production 2',
            status: 'running',
            overall_severity: 'normal',
            vibration_current: 0,
            temperature_current: 0,
            sound_current: 0,
            created_at: new Date().toISOString()
          },
          {
            id: 'moteur3',
            name: 'Moteur Auxiliaire C',
            location: 'Ligne de production 3',
            status: 'running',
            overall_severity: 'normal',
            vibration_current: 0,
            temperature_current: 0,
            sound_current: 0,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error('Error seeding motors:', error);
      } else {
        console.log('✅ Initial motors seeded');
      }
    }
  }

  // Motors
  async getMotors() {
    const { data, error } = await this.supabase
      .from('motors')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async getMotorById(id) {
    const { data, error } = await this.supabase
      .from('motors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async updateMotorMetrics(machineId, metrics) {
    try {
      // Convertir les valeurs numériques en décimaux et arrondir
      const sanitizedMetrics = {};
      
      Object.keys(metrics).forEach(key => {
        const value = metrics[key];
        if (typeof value === 'number') {
          // Arrondir à 4 décimales maximum
          sanitizedMetrics[key] = Math.round(value * 10000) / 10000;
        } else {
          sanitizedMetrics[key] = value;
        }
      });

      const { data, error } = await this.supabase
        .from('motors')
        .update({
          ...sanitizedMetrics,
          last_updated: new Date().toISOString()
        })
        .eq('id', machineId)
        .select()
        .single();

      if (error) throw error;
      return { data };
    } catch (error) {
      console.error('Erreur lors de la mise à jour des métriques:', error);
      throw error;
    }
  }

  async updateMotorStatus(machineId, statusData) {
    const { data, error } = await this.supabase
      .from('motors')
      .update(statusData)
      .eq('id', machineId)
      .select()
      .single();

    if (error) throw error;
    return { data };
  }

  // Raw sensor data - CORRIGÉ pour retourner les données insérées
  async insertRawSensorData(data) {
    try {
      // Sanitiser les données avant insertion
      const sanitizedData = {
        machine_id: data.machine_id,
        timestamp_rpi: data.timestamp_rpi,
        temperature_c: data.temperature_c ? Math.round(data.temperature_c * 10000) / 10000 : null,
        sound_amplitude: data.sound_amplitude ? Math.round(data.sound_amplitude * 10000) / 10000 : null,
        accel_x_g: data.accel_x_g ? Math.round(data.accel_x_g * 1000000) / 1000000 : null,
        accel_y_g: data.accel_y_g ? Math.round(data.accel_y_g * 1000000) / 1000000 : null,
        accel_z_g: data.accel_z_g ? Math.round(data.accel_z_g * 1000000) / 1000000 : null
      };

      const { data: insertedData, error } = await this.supabase
        .from('raw_sensor_data')
        .insert(sanitizedData)
        .select()
        .single();

      if (error) throw error;
      return { data: insertedData };
    } catch (error) {
      console.error('Erreur lors de l\'insertion des données brutes:', error);
      throw error;
    }
  }

  async getRawSensorData(machineId, limit = 1000, offset = 0) {
    const { data, error } = await this.supabase
      .from('raw_sensor_data')
      .select('*')
      .eq('machine_id', machineId)
      .order('timestamp_rpi', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data;
  }

  // Anomalies - CORRIGÉ pour retourner les données insérées
  async insertAnomaly(anomaly) {
    try {
      const sanitizedAnomaly = {
        ...anomaly,
        detected_at: anomaly.detected_at || new Date().toISOString(),
        prediction_confidence: anomaly.prediction_confidence ? 
          Math.round(anomaly.prediction_confidence * 10000) / 10000 : null
      };

      const { data, error } = await this.supabase
        .from('anomalies')
        .insert(sanitizedAnomaly)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Anomalie insérée avec ID:', data.id);
      return { data };
    } catch (error) {
      console.error('Erreur lors de l\'insertion de l\'anomalie:', error);
      throw error;
    }
  }

  async getAnomalies(machineId = null, limit = 100) {
    let query = this.supabase
      .from('anomalies')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (machineId) {
      query = query.eq('machine_id', machineId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Predictions - CORRIGÉ pour retourner les données insérées
  async insertPrediction(prediction) {
    try {
      const sanitizedPrediction = {
        machine_id: prediction.machine_id,
        prediction_type: prediction.prediction_type,
        confidence: prediction.confidence ? Math.round(prediction.confidence * 10000) / 10000 : null,
        severity: prediction.severity,
        timestamp: prediction.timestamp || new Date().toISOString(),
        xgb_prediction: prediction.xgb_prediction || null,
        xgb_confidence: prediction.xgb_confidence ? Math.round(prediction.xgb_confidence * 10000) / 10000 : null,
        dl_prediction: prediction.dl_prediction || null,
        dl_confidence: prediction.dl_confidence ? Math.round(prediction.dl_confidence * 10000) / 10000 : null,
        raw_data_sample: prediction.raw_data_sample || null
      };

      const { data, error } = await this.supabase
        .from('predictions')
        .insert(sanitizedPrediction)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Prédiction insérée avec ID:', data.id);
      return { data };
    } catch (error) {
      console.error('Erreur lors de l\'insertion de la prédiction:', error);
      throw error;
    }
  }

  async getPredictions(machineId = null, limit = 100) {
    let query = this.supabase
      .from('predictions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (machineId) {
      query = query.eq('machine_id', machineId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getLatestPrediction(machineId) {
    const { data, error } = await this.supabase
      .from('predictions')
      .select('*')
      .eq('machine_id', machineId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // NOUVELLES MÉTHODES pour les tests et diagnostics
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('motors')
        .select('count')
        .limit(1);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Test de connexion Supabase échoué:', error);
      return false;
    }
  }

  // Méthode pour nettoyer les vieilles données (optionnel)
  async cleanupOldData(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffISO = cutoffDate.toISOString();

      // Nettoyer les anciennes données brutes
      const { error: rawDataError } = await this.supabase
        .from('raw_sensor_data')
        .delete()
        .lt('timestamp_rpi', cutoffISO);

      if (rawDataError) {
        console.error('Erreur nettoyage données brutes:', rawDataError);
      } else {
        console.log(`✅ Données brutes de plus de ${daysToKeep} jours supprimées`);
      }

      // Nettoyer les anciennes prédictions (garder les anomalies plus longtemps)
      const { error: predictionsError } = await this.supabase
        .from('predictions')
        .delete()
        .lt('timestamp', cutoffISO)
        .eq('prediction_type', 'Normal'); // Supprimer uniquement les prédictions "Normal"

      if (predictionsError) {
        console.error('Erreur nettoyage prédictions:', predictionsError);
      } else {
        console.log(`✅ Prédictions "Normal" de plus de ${daysToKeep} jours supprimées`);
      }

    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
    }
  }

  // Statistiques pour le dashboard
  async getSystemStats() {
    try {
      // Compter les enregistrements récents
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: recentPredictions } = await this.supabase
        .from('predictions')
        .select('count')
        .gte('timestamp', oneDayAgo.toISOString());

      const { data: recentAnomalies } = await this.supabase
        .from('anomalies')
        .select('count')
        .gte('detected_at', oneDayAgo.toISOString());

      const { data: totalMotors } = await this.supabase
        .from('motors')
        .select('count');

      return {
        total_motors: totalMotors?.[0]?.count || 0,
        predictions_24h: recentPredictions?.[0]?.count || 0,
        anomalies_24h: recentAnomalies?.[0]?.count || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erreur récupération stats système:', error);
      return {
        total_motors: 0,
        predictions_24h: 0,
        anomalies_24h: 0,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new SupabaseService();