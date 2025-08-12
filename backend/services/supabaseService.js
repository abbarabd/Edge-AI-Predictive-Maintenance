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
      // Insérer des moteurs de test
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
    const { error } = await this.supabase
      .from('motors')
      .update(metrics)
      .eq('id', machineId);

    if (error) throw error;
  }

  async updateMotorStatus(machineId, statusData) {
    const { error } = await this.supabase
      .from('motors')
      .update(statusData)
      .eq('id', machineId);

    if (error) throw error;
  }

  // Raw sensor data
  async insertRawSensorData(data) {
    const { error } = await this.supabase
      .from('raw_sensor_data')
      .insert(data);

    if (error) throw error;
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

  // Anomalies
  async insertAnomaly(anomaly) {
    const { error } = await this.supabase
      .from('anomalies')
      .insert(anomaly);

    if (error) throw error;
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

  // Predictions
  async insertPrediction(prediction) {
    const { error } = await this.supabase
      .from('predictions')
      .insert(prediction);

    if (error) throw error;
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
}

module.exports = new SupabaseService();