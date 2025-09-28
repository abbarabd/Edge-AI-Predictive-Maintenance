/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { Motor } from '@/types/motor';
import apiService from '@/services/apiService';
import websocketService from '@/services/websocketService';
import { MotorCard } from './MotorCard';
import { MotorDetails } from './MotorDetails';
import { AlertsPanel } from './AlertsPanel';
import { ReportsPanel } from './ReportsPanel';
import { SettingsPanel } from './SettingsPanel';
import { 
  Activity, 
  AlertTriangle, 
  Settings, 
  Thermometer, 
  Volume2, 
  Zap,
  TrendingUp,
  Eye,
  RefreshCw
} from 'lucide-react';

interface SystemMetrics {
  totalMotors: number;
  activeAlerts: number;
  criticalMotors: number;
  maintenanceRequired: number;
  systemEfficiency: number;
  averageTemperature: number;
  averageVibration: number;
  averageSound: number;
  healthScore: number;
  uptimePercentage: number;
}

interface SensorThresholds {
  temperature: { warning: number; critical: number };
  vibration: { warning: number; critical: number };
  sound: { warning: number; critical: number };
}

interface RealtimeStats {
  connectedDevices: number;
  connected_clients: number;
  mqttMessages: number;
  successRate: string;
  anomaliesDetected: number;
  totalEvents: number;
}

// Utilitaires de validation
const validateProgressValue = (value: number | null | undefined, min = 0, max = 100): number => {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value) || value === null || value === undefined) {
    return 0;
  }
  return Math.max(min, Math.min(max, value));
};

const formatSensorValue = (value: number | null | undefined, decimals = 1): string => {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return '0.0';
  }
  return value.toFixed(decimals);
};

const Dashboard = () => {
  const [motors, setMotors] = useState<Motor[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null);
  const [thresholds, setThresholds] = useState<SensorThresholds>({
    temperature: { warning: 35, critical: 40 },
    vibration: { warning: 1.2, critical: 1.8 },
    sound: { warning: 0.8, critical: 1.0 }
  });

  // CALCULS DYNAMIQUES DES MÉTRIQUES (Version corrigée)
  const calculateSystemMetrics = useCallback(async (motorsData: Motor[]): Promise<SystemMetrics> => {
    try {
      // Récupérer les données récentes pour chaque moteur
      const motorsWithRecentData = await Promise.all(
        motorsData.map(async (motor) => {
          try {
            // Récupérer les 10 dernières données de capteurs
            const recentData = await apiService.getRecentSensorData(motor.id, 10);
            return { ...motor, recentSensorData: recentData };
          } catch (error) {
            console.error(`Erreur données récentes pour ${motor.id}:`, error);
            return { ...motor, recentSensorData: [] };
          }
        })
      );

      // Calculer les moyennes réelles
      let totalTemp = 0, totalVib = 0, totalSound = 0, validReadings = 0;
      
      motorsWithRecentData.forEach((motor) => {
        if (motor.recentSensorData && motor.recentSensorData.length > 0) {
          motor.recentSensorData.forEach((reading: any) => {
            if (reading.temperature_c !== null && reading.temperature_c > 0) {
              totalTemp += reading.temperature_c;
            }
            if (reading.accel_x_g !== null && reading.accel_y_g !== null && reading.accel_z_g !== null) {
              const vibMagnitude = Math.sqrt(
                reading.accel_x_g ** 2 + reading.accel_y_g ** 2 + reading.accel_z_g ** 2
              );
              totalVib += vibMagnitude;
            }
            if (reading.sound_amplitude !== null) {
              totalSound += reading.sound_amplitude;
            }
            validReadings++;
          });
        }
      });

      const avgTemp = validReadings > 0 ? totalTemp / validReadings : 0;
      const avgVib = validReadings > 0 ? totalVib / validReadings : 0;
      const avgSound = validReadings > 0 ? totalSound / validReadings : 0;

      // Calculer les métriques système
      const totalAnomalies = motorsData.reduce((total, motor) => total + (motor.anomalies?.length || 0), 0);
      const criticalMotors = motorsData.filter(motor => motor.overallSeverity === 'critical').length;
      const runningMotors = motorsData.filter(motor => motor.status === 'running').length;
      const maintenanceRequired = motorsData.filter(motor => motor.status === 'maintenance').length;
      
      const systemEfficiency = Math.max(0, 100 - (totalAnomalies * 2) - (criticalMotors * 10));
      const healthScore = motorsData.length > 0 ? Math.round((runningMotors / motorsData.length) * 100) : 100;
      const uptimePercentage = motorsData.length > 0 ? Math.round(((motorsData.length - criticalMotors) / motorsData.length) * 100) : 100;

      return {
        totalMotors: motorsData.length,
        activeAlerts: totalAnomalies,
        criticalMotors: criticalMotors,
        maintenanceRequired: maintenanceRequired,
        systemEfficiency: Math.round(systemEfficiency * 100) / 100,
        averageTemperature: Math.round(avgTemp * 10) / 10,
        averageVibration: Math.round(avgVib * 100) / 100,
        averageSound: Math.round(avgSound * 100) / 100,
        healthScore,
        uptimePercentage
      };
    } catch (error) {
      console.error('Erreur calcul métriques système:', error);
      
      // Fallback avec calculs basiques
      const totalAnomalies = motorsData.reduce((total, motor) => total + (motor.anomalies?.length || 0), 0);
      const criticalMotors = motorsData.filter(motor => motor.overallSeverity === 'critical').length;
      const runningMotors = motorsData.filter(motor => motor.status === 'running').length;
      
      return {
        totalMotors: motorsData.length,
        activeAlerts: totalAnomalies,
        criticalMotors: criticalMotors,
        maintenanceRequired: motorsData.filter(motor => motor.status === 'maintenance').length,
        systemEfficiency: Math.max(0, 100 - (totalAnomalies * 2) - (criticalMotors * 10)),
        averageTemperature: 0,
        averageVibration: 0,
        averageSound: 0,
        healthScore: motorsData.length > 0 ? Math.round((runningMotors / motorsData.length) * 100) : 100,
        uptimePercentage: motorsData.length > 0 ? Math.round(((motorsData.length - criticalMotors) / motorsData.length) * 100) : 100
      };
    }
  }, []);

  // CHARGEMENT DYNAMIQUE DES SEUILS
  const loadThresholds = useCallback(async () => {
    try {
      // Charger les seuils globaux ou par défaut du serveur
      const globalThresholds = await apiService.getGlobalThresholds();
      setThresholds(globalThresholds);
    } catch (error) {
      console.error('Erreur lors du chargement des seuils:', error);
      // Garder les seuils par défaut
    }
  }, []);

  const loadMotorsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const motorsData = await apiService.getMotors() as Motor[];
      setMotors(motorsData);
      
      // Calculer les métriques dynamiquement
      const metrics = await calculateSystemMetrics(motorsData);
      setSystemMetrics(metrics);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateSystemMetrics]);

  const connectWebSocket = useCallback(async () => {
    try {
      await websocketService.connect();
      setIsConnected(true);
      
      // Écouter les mises à jour en temps réel
      websocketService.onMotorStatusUpdate((data) => {
        console.log('📡 Mise à jour moteur:', data);
        setMotors(prev => {
          const updated = prev.map(motor => 
            motor.id === data.motorId 
              ? { ...motor, ...data.updates }
              : motor
          );
          // Recalculer les métriques après mise à jour
          calculateSystemMetrics(updated).then(setSystemMetrics);
          return updated;
        });
        setLastUpdate(new Date());
      });
      
      websocketService.onNewAnomaly((data) => {
        console.log('🚨 Nouvelle anomalie:', data);
        setMotors(prev => {
          const updated = prev.map(motor => 
            motor.id === data.motorId 
              ? { ...motor, anomalies: [data.anomaly, ...motor.anomalies] }
              : motor
          );
          calculateSystemMetrics(updated).then(setSystemMetrics);
          return updated;
        });
        setLastUpdate(new Date());
      });

      // Écouter les statistiques du serveur
      websocketService.onStats((stats) => {
        console.log('📊 Statistiques reçues:', stats);
        setRealtimeStats(stats.raspberry_pi || stats);
      });

      // Écouter les données capteur en temps réel
      websocketService.onRawSensorData((data) => {
        console.log('📊 Données capteur:', data);
        setLastUpdate(new Date());
      });

      // Écouter les nouvelles prédictions
      websocketService.onNewPrediction((data) => {
        console.log('🔮 Nouvelle prédiction dans Dashboard:', data);
        setLastUpdate(new Date());
      });

      // NOUVEAU: Récupérer les stats initiales
      try {
        const initialStats = await apiService.getSystemStats();
        setRealtimeStats(initialStats.raspberry_pi || initialStats);
      } catch (error) {
        console.error('Erreur chargement stats initiales:', error);
      }

    } catch (error) {
      console.error('Erreur de connexion WebSocket:', error);
      setIsConnected(false);
    }
  }, [calculateSystemMetrics]);

  useEffect(() => {
    loadThresholds();
    loadMotorsData();
    connectWebSocket();

    // Actualiser les données toutes les 30 secondes
    const interval = setInterval(() => {
      loadMotorsData();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadThresholds, loadMotorsData, connectWebSocket]);

  // FONCTION POUR CALCULER LE POURCENTAGE BASÉ SUR LES SEUILS DYNAMIQUES
  const calculatePercentage = (value: number, type: 'temperature' | 'vibration' | 'sound'): number => {
    const threshold = thresholds[type];
    const max = threshold.critical * 1.2; // 120% du seuil critique comme maximum
    return Math.min(100, (value / max) * 100);
  };

  // FONCTION POUR OBTENIR LA COULEUR BASÉE SUR LE SEUIL
  const getValueColor = (value: number, type: 'temperature' | 'vibration' | 'sound'): string => {
    const threshold = thresholds[type];
    if (value >= threshold.critical) return 'text-severity-critical';
    if (value >= threshold.warning) return 'text-severity-warning';
    return 'text-success';
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'elevated': return 'secondary';
      case 'warning': return 'outline';
      default: return 'default';
    }
  };

  const handleRefresh = () => {
    loadMotorsData();
  };

  if (isLoading && !systemMetrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (selectedMotor && activeTab === 'motors') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setSelectedMotor(null)}
            className="mb-4"
          >
            ← Retour à la vue d'ensemble
          </Button>
        </div>
        <MotorDetails motor={selectedMotor} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header avec plus d'infos dynamiques */}
      <header className="border-b border-border bg-card shadow-sm">
  <div className="container mx-auto px-6 py-4">
    <div className="flex items-center justify-between">
      {/* Section gauche : Titre + description */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          Dashboard Maintenance Prédictive
        </h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Surveillance en temps réel • {systemMetrics?.totalMotors || 0} équipements
          {realtimeStats && (
            <span> • {realtimeStats.connected_clients} devices connectés</span>
          )}
        </p>
      </div>

      {/* Section droite : Actions + Statut */}
      <div className="flex items-center space-x-6">
        {/* Bouton Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="hover:bg-accent hover:text-accent-foreground transition"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        {/* Statut connexion */}
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full transition ${
              isConnected ? "bg-success" : "bg-severity-critical"
            }`}
          />
          <span
            className={`text-sm font-medium ${
              isConnected ? "text-success" : "text-severity-critical"
            }`}
          >
            {isConnected ? "Connecté" : "Déconnecté"}
          </span>
        </div>

        {/* Dernière mise à jour */}
        <div className="text-right">
          <div className="text-xs text-muted-foreground">
            Dernière mise à jour
          </div>
          <div className="text-sm font-semibold text-foreground">
            {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  </div>
</header>

      <div className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="motors">Moteurs</TabsTrigger>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Métriques globales DYNAMIQUES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Moteurs Actifs</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemMetrics?.totalMotors || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {motors.filter(m => m.status === 'running').length} en fonctionnement
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-severity-warning">
                    {systemMetrics?.activeAlerts || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {systemMetrics?.criticalMotors || 0} critiques
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Efficacité Système</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">
                    {systemMetrics?.systemEfficiency || 0}%
                  </div>
                  <Progress 
                    value={systemMetrics?.systemEfficiency || 0} 
                    className="mt-2 h-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Score Santé</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {systemMetrics?.healthScore || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Disponibilité: {systemMetrics?.uptimePercentage || 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-severity-elevated">
                    {systemMetrics?.maintenanceRequired || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Interventions requises
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Moyennes des capteurs DYNAMIQUES avec seuils adaptatifs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span>Vibrations Moyennes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold mb-2 ${getValueColor(systemMetrics?.averageVibration || 0, 'vibration')}`}>
                    {formatSensorValue(systemMetrics?.averageVibration)}g
                  </div>
                  <Progress 
                    value={validateProgressValue(calculatePercentage(systemMetrics?.averageVibration || 0, 'vibration'))} 
                    className="h-3" 
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Seuil critique: {formatSensorValue(thresholds.vibration.critical)}g
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Volume2 className="h-5 w-5 text-primary" />
                    <span>Niveau Sonore Moyen</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold mb-2 ${getValueColor(systemMetrics?.averageSound || 0, 'sound')}`}>
                    {formatSensorValue(systemMetrics?.averageSound)}
                  </div>
                  <Progress 
                    value={validateProgressValue(calculatePercentage(systemMetrics?.averageSound || 0, 'sound'))} 
                    className="h-3" 
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Seuil critique: {formatSensorValue(thresholds.sound.critical)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Thermometer className="h-5 w-5 text-primary" />
                    <span>Température Moyenne</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold mb-2 ${getValueColor(systemMetrics?.averageTemperature || 0, 'temperature')}`}>
                    {formatSensorValue(systemMetrics?.averageTemperature)}°C
                  </div>
                  <Progress 
                    value={validateProgressValue(calculatePercentage(systemMetrics?.averageTemperature || 0, 'temperature'))} 
                    className="h-3" 
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Seuil critique: {formatSensorValue(thresholds.temperature.critical)}°C
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Statistiques en temps réel */}
           {realtimeStats && (
  <Card>
    <CardHeader>
      <CardTitle>Statistiques Temps Réel</CardTitle>
      <CardDescription>Métriques du serveur et des Raspberry Pi</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">
            {realtimeStats.connected_clients || 0}
          </div>
          <p className="text-sm text-muted-foreground">Devices connectés</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-accent">
            {realtimeStats.totalEvents || 0}
          </div>
          <p className="text-sm text-muted-foreground">Événements traités</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-severity-warning">
            {realtimeStats.anomaliesDetected || 0}
          </div>
          <p className="text-sm text-muted-foreground">Anomalies détectées</p>
        </div>
      </div>
      
    </CardContent>
  </Card>
)}

{/* Si aucune statistique n'est disponible, afficher un placeholder */}
{!realtimeStats && (
  <Card>
    <CardHeader>
      <CardTitle>Statistiques Temps Réel</CardTitle>
      <CardDescription>En attente des données du serveur...</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">--</div>
          <p className="text-sm text-muted-foreground">Devices connectés</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">--</div>
          <p className="text-sm text-muted-foreground">Événements traités</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">--</div>
          <p className="text-sm text-muted-foreground">Anomalies détectées</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">--</div>
          <p className="text-sm text-muted-foreground">Taux de succès</p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
            {/* État des moteurs */}
            <Card>
              <CardHeader>
                <CardTitle>État des Moteurs par Sévérité</CardTitle>
                <CardDescription>
                  Vue d'ensemble de tous les moteurs et de leur niveau d'anomalie
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {motors.map((motor) => (
                    <div
                      key={motor.id}
                      className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedMotor(motor);
                        setActiveTab('motors');
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{motor.name}</h3>
                        <Badge variant={getSeverityBadgeVariant(motor.overallSeverity)}>
                          {motor.overallSeverity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{motor.location}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {motor.anomalies.length} anomalie(s)
                        </span>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="motors" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {motors.map((motor) => (
                <MotorCard
                  key={motor.id}
                  motor={motor}
                  onSelect={() => setSelectedMotor(motor)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsPanel motors={motors} />
          </TabsContent>
          
          <TabsContent value="reports">
            <ReportsPanel motors={motors} />
          </TabsContent>
        </Tabs>
      </div>
       <SettingsPanel />
    </div>
  );
};

export default Dashboard;