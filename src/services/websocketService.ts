/* eslint-disable @typescript-eslint/no-explicit-any */
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
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
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('📡 WebSocket disconnected');
    }
  }

  // Événements en temps réel
  onRawSensorData(callback: (data: any) => void): void {
    this.socket?.on('rawSensorData', callback);
  }

  onPredictionUpdate(callback: (data: any) => void): void {
    this.socket?.on('predictionUpdate', callback);
  }

  onNewAnomaly(callback: (data: any) => void): void {
    this.socket?.on('newAnomaly', callback);
  }

  onMetricsUpdate(callback: (data: any) => void): void {
    this.socket?.on('metricsUpdate', callback);
  }

  onMotorStatusUpdate(callback: (data: any) => void): void {
    this.socket?.on('motorStatusUpdate', callback);
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
}

export const websocketService = new WebSocketService();
export default websocketService;