/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private readonly serverUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;

  constructor() {
    this.serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectInterval,
        });

        this.socket.on('connect', () => {
          console.log('✅ Connected to WebSocket server');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('disconnect', (reason: any) => {
          console.log('📡 Disconnected from WebSocket server:', reason);
        });

        this.socket.on('connect_error', (error: any) => {
          console.error('❌ WebSocket connection error:', error);
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Failed to connect to WebSocket server'));
          }
        });

        this.socket.on('reconnect', (attemptNumber: any) => {
          console.log(`🔄 Reconnected to WebSocket server (attempt ${attemptNumber})`);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('❌ Failed to reconnect to WebSocket server');
        });

      } catch (error) {
        console.error('❌ Error initializing WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.cleanup();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('📡 WebSocket disconnected');
    }
  }


  onNewAnomaly(callback: (data: any) => void): void {
    this.socket?.on('new-anomaly', callback); // backend envoie new-anomaly
  }

  onMotorStatusUpdate(callback: (data: any) => void): void {
    this.socket?.on('motor-update', callback); // backend envoie motor-update
  }

  /**
   * Écoute les statistiques du serveur en temps réel
   */
  onStats(callback: (stats: any) => void): void {
    if (this.socket) {
      this.socket.on('stats', callback);
    }
    this.addListener('stats', callback);
  }

  /**
   * Écoute les données de capteurs brutes en temps réel
   */
  onRawSensorData(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('rawSensorData', callback);
    }
    this.addListener('rawSensorData', callback);
  }

  /**
   * Écoute les mises à jour de métriques
   */
  onMetricsUpdate(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('metricsUpdate', callback);
    }
    this.addListener('metricsUpdate', callback);
  }

  /**
   * Écoute les erreurs de données
   */
  onDataError(callback: (error: any) => void): void {
    if (this.socket) {
      this.socket.on('dataError', callback);
    }
    this.addListener('dataError', callback);
  }

  /**
   * Écoute les connexions/déconnexions de devices
   */
  onDeviceConnected(callback: (device: any) => void): void {
    if (this.socket) {
      this.socket.on('device-connected', callback);
    }
    this.addListener('device-connected', callback);
  }

  /**
   * Écoute les mises à jour de statut des devices
   */
  onDeviceStatusUpdate(callback: (status: any) => void): void {
    if (this.socket) {
      this.socket.on('device-status-update', callback);
    }
    this.addListener('device-status-update', callback);
  }

  /**
   * Écoute les nouvelles prédictions
   */
  onNewPrediction(callback: (prediction: any) => void): void {
    if (this.socket) {
      this.socket.on('new-prediction', callback);
    }
    this.addListener('new-prediction', callback);
  }

  /**
   * Ping les devices connectés
   */
  pingDevices(): void {
    if (this.socket) {
      this.socket.emit('ping-devices');
    }
  }

  /**
   * S'identifier comme Raspberry Pi
   */
  identifyAsRaspberryPi(deviceId: string): void {
    if (this.socket) {
      this.socket.emit('raspberry-pi-connect', { device_id: deviceId });
    }
  }

  /**
   * Envoie des données de capteur via WebSocket
   */
  sendSensorData(data: any): void {
    if (this.socket) {
      this.socket.emit('sensor-data', data);
    }
  }

  /**
   * Envoie une prédiction via WebSocket
   */
  sendPrediction(prediction: any): void {
    if (this.socket) {
      this.socket.emit('prediction-alert', prediction);
    }
  }

  // Méthode helper pour gérer les listeners
  private addListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // Nettoyer les listeners lors de la déconnexion
  private cleanup(): void {
    if (this.socket) {
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          this.socket!.off(event, callback as any);
        });
      });
    }
    this.listeners.clear();
  }

  // Nettoyage des événements
  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  removeListener(event: string, callback?: (...args: any[]) => void): void {
  this.off(event, callback);
  }


}

export const websocketService = new WebSocketService();
export default websocketService;
