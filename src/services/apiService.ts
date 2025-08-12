/* eslint-disable @typescript-eslint/no-explicit-any */
class ApiService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Motors API
  async getMotors() {
    return this.request('/motors');
  }

  async getMotor(id: string) {
    return this.request(`/motors/${id}`);
  }

  async updateMotorStatus(id: string, status: string, severity: string) {
    return this.request(`/motors/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, overall_severity: severity }),
    });
  }

  // Anomalies API
  async getAnomalies(machineId?: string, limit = 100, severity?: string) {
    const params = new URLSearchParams();
    if (machineId) params.append('machineId', machineId);
    if (limit) params.append('limit', limit.toString());
    if (severity) params.append('severity', severity);
    
    return this.request(`/anomalies?${params.toString()}`);
  }

  async getAnomalyStats(machineId?: string) {
    const params = machineId ? `?machineId=${machineId}` : '';
    return this.request(`/anomalies/stats${params}`);
  }

  async createAnomaly(anomalyData: any) {
    return this.request('/anomalies', {
      method: 'POST',
      body: JSON.stringify(anomalyData),
    });
  }

  // Predictions API
  async getPredictions(machineId?: string, limit = 100) {
    const params = new URLSearchParams();
    if (machineId) params.append('machineId', machineId);
    if (limit) params.append('limit', limit.toString());
    
    return this.request(`/predictions?${params.toString()}`);
  }

  async getLatestPrediction(machineId: string) {
    return this.request(`/predictions/latest/${machineId}`);
  }

  async getPredictionStats(machineId?: string) {
    const params = machineId ? `?machineId=${machineId}` : '';
    return this.request(`/predictions/stats${params}`);
  }

  // Raw Data API
  async getRawData(machineId: string, limit = 1000, offset = 0, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    return this.request(`/raw-data/${machineId}?${params.toString()}`);
  }

  async getProcessedData(machineId: string, limit = 500) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    
    return this.request(`/raw-data/${machineId}/processed?${params.toString()}`);
  }

  async getRawDataStats(machineId: string) {
    return this.request(`/raw-data/${machineId}/stats`);
  }

  // Health check
  async getHealth() {
    return this.request('/health');
  }
}

export const apiService = new ApiService();
export default apiService;