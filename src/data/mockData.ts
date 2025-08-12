export interface SensorData {
  timestamp: string;
  value: number;
}

export interface RawSensorData {
  _id: string;
  machineId: string;
  timestamp_rpi: string;
  temperature_c: number;
  accel_x_g: number;
  accel_y_g: number;
  accel_z_g: number;
  raw_sound_analog: number;
  fault_type: string;
  __v: number;
}

export interface Anomaly {
  id: string;
  motorId: string;
  type: 'vibration' | 'sound' | 'temperature' | 'imbalance';
  severity: 'normal' | 'warning' | 'elevated' | 'critical';
  description: string;
  detectedAt: string;
  value: number;
  threshold: number;
}

export interface Motor {
  id: string;
  name: string;
  location: string;
  status: 'running' | 'stopped' | 'maintenance';
  overallSeverity: 'normal' | 'warning' | 'elevated' | 'critical';
  anomalies: Anomaly[];
  vibrationData: SensorData[];
  soundData: SensorData[];
  temperatureData: SensorData[];
  rawSensorData: RawSensorData[];
}

// Générer des données de temps réel simulées
const generateTimeSeriesData = (
  hours: number = 24,
  baseValue: number = 50,
  variance: number = 20,
  anomalyProbability: number = 0.1
): SensorData[] => {
  const data: SensorData[] = [];
  const now = new Date();
  
  for (let i = hours * 60; i >= 0; i -= 5) { // Points toutes les 5 minutes
    const timestamp = new Date(now.getTime() - i * 60 * 1000);
    let value = baseValue + (Math.random() - 0.5) * variance;
    
    // Ajouter des anomalies occasionnelles
    if (Math.random() < anomalyProbability) {
      value += (Math.random() - 0.5) * variance * 2;
    }
    
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.max(0, Math.round(value * 100) / 100)
    });
  }
  
  return data;
};

// Générer des données brutes de capteurs
const generateRawSensorData = (motorId: string, hours: number = 1): RawSensorData[] => {
  const data: RawSensorData[] = [];
  const now = new Date();
  
  // Générer 1000 points sur la période (échantillonnage à 20ms)
  const totalPoints = Math.min(1000, hours * 60 * 60 * 50); // 50 Hz max
  
  for (let i = 0; i < totalPoints; i++) {
    const timestamp = new Date(now.getTime() - (totalPoints - i) * 20); // 20ms entre chaque point
    
    // Simuler des données réalistes
    const baseTemp = 35 + Math.random() * 10;
    const accelMagnitude = 0.1 + Math.random() * 0.05;
    const angle = (i * Math.PI * 2) / 100; // Rotation simulée
    
    const faultType = Math.random() < 0.95 ? 'Normal' : 'Anomaly';
    
    data.push({
      _id: `${motorId}_${i}_${Date.now()}`,
      machineId: motorId,
      timestamp_rpi: timestamp.toISOString(),
      temperature_c: Math.round((baseTemp + (Math.random() - 0.5) * 2) * 100) / 100,
      accel_x_g: Math.round((accelMagnitude * Math.cos(angle) + (Math.random() - 0.5) * 0.02) * 1000) / 1000,
      accel_y_g: Math.round((accelMagnitude * Math.sin(angle) + (Math.random() - 0.5) * 0.02) * 1000) / 1000,
      accel_z_g: Math.round((0.98 + (Math.random() - 0.5) * 0.04) * 1000) / 1000,
      raw_sound_analog: Math.round(1500 + Math.random() * 200),
      fault_type: faultType,
      __v: 0
    });
  }
  
  return data;
};

// Générer des anomalies pour un moteur
const generateAnomalies = (motorId: string, count: number = 5): Anomaly[] => {
  const types: Anomaly['type'][] = ['vibration', 'sound', 'temperature', 'imbalance'];
  const severities: Anomaly['severity'][] = ['warning', 'elevated', 'critical'];
  const descriptions = {
    vibration: ['Vibrations excessives détectées', 'Résonance anormale', 'Déséquilibre rotatif'],
    sound: ['Bruit anormal détecté', 'Fréquence acoustique élevée', 'Harmoniques inhabituelles'],
    temperature: ['Surchauffe détectée', 'Température élevée', 'Gradient thermique anormal'],
    imbalance: ['Déséquilibre mécanique', 'Balourd important', 'Défaut d\'alignement']
  };

  return Array.from({ length: count }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const now = new Date();
    const detectedAt = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
    
    return {
      id: `${motorId}-anomaly-${i + 1}`,
      motorId,
      type,
      severity,
      description: descriptions[type][Math.floor(Math.random() * descriptions[type].length)],
      detectedAt: detectedAt.toISOString(),
      value: Math.round((Math.random() * 100 + 50) * 100) / 100,
      threshold: type === 'temperature' ? 75 : type === 'vibration' ? 50 : 60
    };
  });
};

// Données simulées des moteurs
export const mockMotors: Motor[] = [
  {
    id: 'motor-001',
    name: 'Moteur Principal A',
    location: 'Ligne de production 1',
    status: 'running',
    overallSeverity: 'elevated',
    anomalies: generateAnomalies('motor-001', 3),
    vibrationData: generateTimeSeriesData(24, 45, 15, 0.15),
    soundData: generateTimeSeriesData(24, 55, 12, 0.12),
    temperatureData: generateTimeSeriesData(24, 68, 8, 0.08),
    rawSensorData: generateRawSensorData('motor-001', 1)
  },
  {
    id: 'motor-002',
    name: 'Moteur Auxiliaire B',
    location: 'Ligne de production 2',
    status: 'running',
    overallSeverity: 'normal',
    anomalies: generateAnomalies('motor-002', 1),
    vibrationData: generateTimeSeriesData(24, 35, 10, 0.05),
    soundData: generateTimeSeriesData(24, 48, 8, 0.06),
    temperatureData: generateTimeSeriesData(24, 58, 6, 0.04),
    rawSensorData: generateRawSensorData('motor-002', 1)
  },
  {
    id: 'motor-003',
    name: 'Moteur Ventilation C',
    location: 'Système HVAC',
    status: 'running',
    overallSeverity: 'warning',
    anomalies: generateAnomalies('motor-003', 2),
    vibrationData: generateTimeSeriesData(24, 40, 12, 0.1),
    soundData: generateTimeSeriesData(24, 52, 10, 0.08),
    temperatureData: generateTimeSeriesData(24, 62, 7, 0.06),
    rawSensorData: generateRawSensorData('motor-003', 1)
  },
  {
    id: 'motor-004',
    name: 'Moteur Pompe D',
    location: 'Circuit hydraulique',
    status: 'maintenance',
    overallSeverity: 'critical',
    anomalies: generateAnomalies('motor-004', 6),
    vibrationData: generateTimeSeriesData(24, 65, 25, 0.25),
    soundData: generateTimeSeriesData(24, 70, 20, 0.2),
    temperatureData: generateTimeSeriesData(24, 82, 12, 0.15),
    rawSensorData: generateRawSensorData('motor-004', 1)
  },
  {
    id: 'motor-005',
    name: 'Moteur Convoyeur E',
    location: 'Ligne d\'assemblage',
    status: 'running',
    overallSeverity: 'normal',
    anomalies: generateAnomalies('motor-005', 1),
    vibrationData: generateTimeSeriesData(24, 38, 8, 0.03),
    soundData: generateTimeSeriesData(24, 45, 6, 0.04),
    temperatureData: generateTimeSeriesData(24, 55, 5, 0.02),
    rawSensorData: generateRawSensorData('motor-005', 1)
  },
  {
    id: 'motor-006',
    name: 'Moteur Compresseur F',
    location: 'Salle des machines',
    status: 'running',
    overallSeverity: 'elevated',
    anomalies: generateAnomalies('motor-006', 4),
    vibrationData: generateTimeSeriesData(24, 55, 18, 0.18),
    soundData: generateTimeSeriesData(24, 65, 15, 0.15),
    temperatureData: generateTimeSeriesData(24, 72, 10, 0.12),
    rawSensorData: generateRawSensorData('motor-006', 1)
  }
];

// Métriques globales du système
export const systemMetrics = {
  totalMotors: mockMotors.length,
  activeAlerts: mockMotors.reduce((total, motor) => total + motor.anomalies.length, 0),
  criticalMotors: mockMotors.filter(motor => motor.overallSeverity === 'critical').length,
  maintenanceRequired: mockMotors.filter(motor => motor.status === 'maintenance').length,
  systemEfficiency: 87.5,
  averageTemperature: 64.2,
  averageVibration: 42.8,
  averageSound: 56.3
};