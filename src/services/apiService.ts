/* eslint-disable @typescript-eslint/no-explicit-any */
// services/ApiService.ts

class ApiService {
  private baseURL: string;
  private authToken: string | null = null;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  /**
   * Cache avec TTL (Time To Live)
   */
  private setCache(key: string, data: any, ttlSeconds: number = 60) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }

  private getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Configuration des headers HTTP
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Définir le token d'authentification
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Supprimer le token d'authentification
   */
  clearAuthToken() {
    this.authToken = null;
  }

  /**
   * Méthode générique pour les requêtes HTTP avec cache et limitation
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    useCache: boolean = false,
    cacheTTL: number = 60
  ): Promise<T> {
    const cacheKey = `${endpoint}_${JSON.stringify(options)}`;
    
    // Vérifier le cache si activé
    if (useCache) {
      const cachedData = this.getCache(cacheKey);
      if (cachedData) {
        console.log(`📦 Cache hit pour ${endpoint}`);
        return cachedData;
      }
    }

    try {
      // Ajouter un timeout et contrôleur d'abort
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: this.getHeaders(),
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      let data: T;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text() as any;
      }

      // Mettre en cache si activé
      if (useCache) {
        this.setCache(cacheKey, data, cacheTTL);
      }

      return data;
    } catch (error: any) {
      console.error(`Erreur API sur ${endpoint}:`, error);
      
      // Si c'est un timeout, essayer de retourner des données en cache même expirées
      if (error.name === 'AbortError' && useCache) {
        const expiredCache = this.cache.get(cacheKey);
        if (expiredCache) {
          console.warn(`⚠️ Timeout sur ${endpoint}, utilisation du cache expiré`);
          return expiredCache.data;
        }
      }
      
      throw error;
    }
  }

  // ===== MOTORS API =====
   // Méthodes avec cache approprié
  
  async getMotors(): Promise<any[]> {
    return this.makeRequest('/api/motors', {}, true, 30); // Cache 30s
  }

  async getMotor(id: string): Promise<any> {
    return this.makeRequest(`/api/motors/${id}`, {}, true, 60); // Cache 1 min
  }


  async updateMotorStatus(id: string, status: string, severity: string) {
    return this.makeRequest(`/api/motors/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, overall_severity: severity }),
    });
  }

  async getMotorHistory(
    motorId: string,
    days: number = 7,
    includeRawData: boolean = false
  ): Promise<any> {
    const params = new URLSearchParams({
      days: days.toString(),
      includeRawData: includeRawData.toString(),
    });
    return this.makeRequest(`/api/motors/${motorId}/history?${params}`);
  }

  async analyzeMotor(motorId: string): Promise<any> {
    return this.makeRequest(`/api/motors/${motorId}/analyze`, {
      method: 'POST',
    });
  }

  async getMotorThresholds(motorId: string): Promise<any> {
    try {
      return await this.makeRequest(`/api/motors/${motorId}/thresholds`);
    } catch (error: any) {
      if (error.message.includes('404')) {
        const globalThresholds = await this.getGlobalThresholds();
        return {
          machine_id: motorId,
          thresholds: globalThresholds,
          baseline: null,
          last_updated: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  async updateMotorThresholds(motorId: string, thresholds: any): Promise<any> {
    return this.makeRequest(`/api/motors/${motorId}/thresholds`, {
      method: 'POST',
      body: JSON.stringify(thresholds),
    });
  }

  // ===== ANOMALIES API =====
   async getAnomalies(limit?: number): Promise<any[]> {
    const queryParams = limit ? `?limit=${limit}` : '';
    return this.makeRequest(`/api/anomalies${queryParams}`, {}, true, 15); // Cache 15s
  }

  async getAnomalyStats(machineId?: string) {
    const params = machineId ? `?machineId=${machineId}` : '';
    return this.makeRequest(`/api/anomalies/stats${params}`);
  }

  async createAnomaly(anomalyData: any) {
    return this.makeRequest('/api/anomalies', {
      method: 'POST',
      body: JSON.stringify(anomalyData),
    });
  }

  // ===== PREDICTIONS API =====
  /**
   * Récupère les prédictions SANS cache pour éviter les boucles
   */
  async getPredictions(motorId?: string, limit?: number): Promise<any[]> {
    let queryParams = '';
    if (motorId || limit) {
      const params = new URLSearchParams();
      if (motorId) params.append('machineId', motorId);
      if (limit) params.append('limit', limit.toString());
      queryParams = `?${params.toString()}`;
    }
    // PAS DE CACHE pour les prédictions - données temps réel critiques
    return this.makeRequest(`/api/predictions${queryParams}`, {}, false);
  }

  async getLatestPrediction(machineId: string) {
    return this.makeRequest(`/api/predictions/latest/${machineId}`);
  }

   /**
   * Récupère les statistiques des prédictions avec cache court
   */
  async getPredictionStats(motorId?: string): Promise<any> {
    const queryParams = motorId ? `?machineId=${motorId}` : '';
    return this.makeRequest(`/api/predictions/stats${queryParams}`, {}, true, 10); // Cache très court 10s
  }

  // ===== RAW DATA API =====
  async getRawData(
    machineId: string,
    limit = 1000,
    offset = 0,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.makeRequest(`/api/raw-data/${machineId}?${params.toString()}`);
  }

  async getProcessedData(machineId: string, limit = 500) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    return this.makeRequest(`/api/raw-data/${machineId}/processed?${params}`);
  }

  async getRawDataStats(machineId: string) {
    return this.makeRequest(`/api/raw-data/${machineId}/stats`);
  }

  /**
   * Récupère les données de capteurs récentes SANS cache
   */
  async getRecentSensorData(motorId: string, limit: number = 100): Promise<any[]> {
    return this.makeRequest(`/api/raw-data/${motorId}?limit=${limit}&sort=desc`, {}, false);
  }


  // ===== SETTINGS & THRESHOLDS =====
   /**
   * Récupère les seuils globaux avec cache long
   */
  async getGlobalThresholds(): Promise<any> {
    try {
      return await this.makeRequest('/api/settings/thresholds/global', {}, true, 300); // Cache 5 min
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.warn('Endpoint seuils globaux non trouvé, utilisation des valeurs par défaut');
        return {
          temperature: { warning: 35, critical: 40 },
          vibration: { warning: 1.2, critical: 1.8 },
          sound: { warning: 0.8, critical: 1.0 }
        };
      }
      throw error;
    }
  }

  /**
   * Met à jour les seuils globaux et invalide le cache
   */
  async updateGlobalThresholds(thresholds: any): Promise<any> {
    const result = await this.makeRequest('/api/settings/thresholds/global', {
      method: 'POST',
      body: JSON.stringify(thresholds),
    }, false);
    
    // Invalider le cache des seuils
    this.cache.delete('/api/settings/thresholds/global_{}');
    return result;
  }

  /**
   * Récupère les statistiques système avec cache
   */
  async getSystemStats(): Promise<any> {
    return this.makeRequest('/api/stats', {}, true, 5); // Cache très court 5s
  }

  async getPerformanceMetrics(): Promise<any> {
    return this.makeRequest('/health');
  }

  async getSystemPerformance(): Promise<any> {
    return this.makeRequest('/api/system/performance');
  }

  async getRealtimeMetrics(): Promise<any> {
    return this.makeRequest('/api/system/realtime');
  }

  /**
   * Vide tout le cache - utile pour debug ou refresh forcé
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cache API vidé');
  }

  /**
   * Affiche les informations du cache - pour debug
   */
  getCacheInfo(): any {
    const cacheInfo = [];
    for (const [key, value] of this.cache.entries()) {
      const age = Date.now() - value.timestamp;
      const remaining = Math.max(0, value.ttl - age);
      cacheInfo.push({
        key,
        age: Math.round(age / 1000) + 's',
        remaining: Math.round(remaining / 1000) + 's',
        expired: remaining <= 0
      });
    }
    return cacheInfo;
  }


  async calculateSystemHealth(motors: any[]): Promise<any> {
    const totalMotors = motors.length;
    const runningMotors = motors.filter((m) => m.status === 'running').length;
    const criticalMotors = motors.filter((m) => m.overallSeverity === 'critical').length;
    const totalAnomalies = motors.reduce(
      (total, motor) => total + (motor.anomalies?.length || 0),
      0
    );

    let avgTemp = 0,
      avgVib = 0,
      avgSound = 0;
    let validReadings = 0;

    motors.forEach((motor) => {
      if (motor.lastSensorData) {
        if (motor.lastSensorData.temperature_c && motor.lastSensorData.temperature_c > 0) {
          avgTemp += motor.lastSensorData.temperature_c;
        }
        if (motor.lastSensorData.vibration) {
          avgVib += motor.lastSensorData.vibration;
        }
        if (motor.lastSensorData.sound_amplitude) {
          avgSound += motor.lastSensorData.sound_amplitude;
        }
        validReadings++;
      }
    });

    if (validReadings > 0) {
      avgTemp /= validReadings;
      avgVib /= validReadings;
      avgSound /= validReadings;
    }

    const systemEfficiency = Math.max(0, 100 - totalAnomalies * 2 - criticalMotors * 10);
    const healthScore = totalMotors > 0 ? (runningMotors / totalMotors) * 100 : 0;
    const uptimePercentage =
      totalMotors > 0 ? ((totalMotors - criticalMotors) / totalMotors) * 100 : 100;

    return {
      averageTemperature: Math.round(avgTemp * 10) / 10,
      averageVibration: Math.round(avgVib * 100) / 100,
      averageSound: Math.round(avgSound * 100) / 100,
      totalReadings: validReadings,
      systemEfficiency: Math.round(systemEfficiency * 100) / 100,
      healthScore: Math.round(healthScore),
      uptimePercentage: Math.round(uptimePercentage),
      dataQuality: validReadings > 0 ? 100 : 0,
    };
  }

  // ===== HEALTH CHECK =====
  async getHealth() {
    return this.makeRequest('/health');
  }

  /**
   * Test de connectivité avec le serveur
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/health', {}, false);
      return true;
    } catch (error) {
      console.error('Test de connexion échoué:', error);
      return false;
    }
  }
}

const apiService = new ApiService();
export default apiService;
