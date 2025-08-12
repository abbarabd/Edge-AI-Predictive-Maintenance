-- Tables pour le système de monitoring des moteurs

-- Table des moteurs
CREATE TABLE IF NOT EXISTS motors (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'maintenance')),
  overall_severity VARCHAR(20) DEFAULT 'normal' CHECK (overall_severity IN ('normal', 'warning', 'elevated', 'critical')),
  vibration_current DECIMAL(10,4) DEFAULT 0,
  temperature_current DECIMAL(10,4) DEFAULT 0,
  sound_current DECIMAL(10,4) DEFAULT 0,
  last_prediction TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des données brutes des capteurs
CREATE TABLE IF NOT EXISTS raw_sensor_data (
  id SERIAL PRIMARY KEY,
  machine_id VARCHAR(50) REFERENCES motors(id) ON DELETE CASCADE,
  timestamp_rpi TIMESTAMP WITH TIME ZONE NOT NULL,
  temperature_c DECIMAL(10,4),
  accel_x_g DECIMAL(10,6),
  accel_y_g DECIMAL(10,6),
  accel_z_g DECIMAL(10,6),
  raw_sound_analog INTEGER,
  sound_amplitude DECIMAL(10,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des anomalies détectées
CREATE TABLE IF NOT EXISTS anomalies (
  id SERIAL PRIMARY KEY,
  machine_id VARCHAR(50) REFERENCES motors(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('vibration', 'temperature', 'sound', 'bearing', 'other')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('normal', 'warning', 'elevated', 'critical')),
  description TEXT,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  value DECIMAL(10,4),
  threshold DECIMAL(10,4),
  prediction_confidence DECIMAL(5,4),
  ml_details JSONB,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des prédictions ML
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  machine_id VARCHAR(50) REFERENCES motors(id) ON DELETE CASCADE,
  prediction_type VARCHAR(50) NOT NULL,
  confidence DECIMAL(5,4),
  severity VARCHAR(20) CHECK (severity IN ('normal', 'warning', 'elevated', 'critical')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  xgb_prediction VARCHAR(50),
  xgb_confidence DECIMAL(5,4),
  dl_prediction VARCHAR(50),
  dl_confidence DECIMAL(5,4),
  raw_data_sample JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_raw_sensor_data_machine_id_timestamp ON raw_sensor_data(machine_id, timestamp_rpi DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_machine_id_detected_at ON anomalies(machine_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_machine_id_timestamp ON predictions(machine_id, timestamp DESC);

-- Fonctions pour l'API Supabase
CREATE OR REPLACE FUNCTION create_motors_table()
RETURNS void AS $$
BEGIN
  -- Cette fonction sera appelée par l'API pour créer la table motors
  -- Le code SQL est déjà exécuté ci-dessus
  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_raw_sensor_data_table()
RETURNS void AS $$
BEGIN
  -- Cette fonction sera appelée par l'API pour créer la table raw_sensor_data
  -- Le code SQL est déjà exécuté ci-dessus
  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_anomalies_table()
RETURNS void AS $$
BEGIN
  -- Cette fonction sera appelée par l'API pour créer la table anomalies
  -- Le code SQL est déjà exécuté ci-dessus
  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_predictions_table()
RETURNS void AS $$
BEGIN
  -- Cette fonction sera appelée par l'API pour créer la table predictions
  -- Le code SQL est déjà exécuté ci-dessus
  RETURN;
END;
$$ LANGUAGE plpgsql;