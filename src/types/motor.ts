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