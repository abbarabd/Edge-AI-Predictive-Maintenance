/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Motor } from '@/types/motor';
import apiService from '@/services/apiService';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  //Calendar
} from 'lucide-react';

interface ReportsPanelProps {
  motors: Motor[];
}

interface SystemReportData {
  totalPredictions: number;
  totalAnomalies: number;
  criticalAnomalies: number;
  systemUptime: number;
  maintenanceEvents: number;
  averageResponseTime: number;
  dataQuality: number;
  periodStart: string;
  periodEnd: string;
}

interface MotorReportData {
  id: string;
  name: string;
  location: string;
  healthScore: number;
  trend: 'improving' | 'stable' | 'declining' | 'critical';
  predictionsCount: number;
  anomaliesCount: number;
  lastMaintenance: string | null;
  currentMetrics: {
    temperature: number;
    vibration: number;
    sound: number;
  };
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export const ReportsPanel = ({ motors }: ReportsPanelProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [reportData, setReportData] = useState<SystemReportData | null>(null);
  const [motorReports, setMotorReports] = useState<MotorReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const periodDays = {
    week: 7,
    month: 30,
    quarter: 90
  };

  // Charger les données de rapport
  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const days = periodDays[selectedPeriod];
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Récupérer les données pour chaque moteur
      const motorReportsPromises = motors.map(async (motor) => {
        try {
          // Récupérer les prédictions récentes pour ce moteur
          const predictions = await apiService.getPredictions(motor.id, 1000);
          const recentPredictions = predictions.filter(p => {
            const predDate = new Date(p.timestamp);
            return predDate >= startDate && predDate <= endDate;
          });

          // Récupérer les anomalies récentes
          const anomalies = await apiService.getAnomalies(50);
          const motorAnomalies = anomalies.filter(a => 
            a.machine_id === motor.id && 
            new Date(a.detected_at) >= startDate && 
            new Date(a.detected_at) <= endDate
          );

          // Récupérer les données capteur récentes
          const recentSensorData = await apiService.getRecentSensorData(motor.id, 100);

          // Calculer les métriques actuelles
          let currentMetrics = { temperature: 0, vibration: 0, sound: 0 };
          if (recentSensorData.length > 0) {
            const latest = recentSensorData[0];
            currentMetrics = {
              temperature: latest.temperature_c || 0,
              vibration: Math.sqrt(
                (latest.accel_x_g || 0) ** 2 + 
                (latest.accel_y_g || 0) ** 2 + 
                (latest.accel_z_g || 0) ** 2
              ),
              sound: latest.sound_amplitude || 0
            };
          }

          // Calculer le score de santé basé sur les anomalies récentes
          const criticalAnomalies = motorAnomalies.filter(a => a.severity === 'critical').length;
          const elevatedAnomalies = motorAnomalies.filter(a => a.severity === 'elevated').length;
          const warningAnomalies = motorAnomalies.filter(a => a.severity === 'warning').length;

          let healthScore = 100;
          healthScore -= criticalAnomalies * 25;
          healthScore -= elevatedAnomalies * 15;
          healthScore -= warningAnomalies * 5;
          healthScore = Math.max(0, healthScore);

          // Déterminer la tendance basée sur les anomalies récentes
          let trend: 'improving' | 'stable' | 'declining' | 'critical' = 'stable';
          if (criticalAnomalies > 0) {
            trend = 'critical';
          } else if (elevatedAnomalies > 2 || warningAnomalies > 5) {
            trend = 'declining';
          } else if (motorAnomalies.length === 0 && healthScore > 90) {
            trend = 'improving';
          }

          // Générer des recommandations basées sur l'état actuel
          const recommendations: string[] = [];
          if (motor.overallSeverity === 'critical') {
            recommendations.push('Arrêt immédiat et inspection complète requis');
            recommendations.push('Vérification des roulements et alignements');
          } else if (motor.overallSeverity === 'elevated') {
            recommendations.push('Maintenance préventive dans les 48h');
            recommendations.push('Surveillance continue des paramètres critiques');
          } else if (motor.overallSeverity === 'warning') {
            recommendations.push('Inspection visuelle et nettoyage');
            recommendations.push('Vérification des connexions électriques');
          } else {
            recommendations.push('Maintenance de routine selon planning');
            recommendations.push('Surveillance continue normale');
          }

          // Déterminer le niveau de risque
          let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
          if (criticalAnomalies > 0) riskLevel = 'critical';
          else if (elevatedAnomalies > 1) riskLevel = 'high';
          else if (warningAnomalies > 3) riskLevel = 'medium';

          return {
            id: motor.id,
            name: motor.name,
            location: motor.location,
            healthScore,
            trend,
            predictionsCount: recentPredictions.length,
            anomaliesCount: motorAnomalies.length,
            lastMaintenance: null, // À récupérer depuis les logs de maintenance si disponible
            currentMetrics,
            recommendations,
            riskLevel
          };
        } catch (error) {
          console.error(`Erreur chargement données pour ${motor.id}:`, error);
          return {
            id: motor.id,
            name: motor.name,
            location: motor.location,
            healthScore: 50,
            trend: 'stable' as const,
            predictionsCount: 0,
            anomaliesCount: 0,
            lastMaintenance: null,
            currentMetrics: { temperature: 0, vibration: 0, sound: 0 },
            recommendations: ['Données non disponibles'],
            riskLevel: 'medium' as const
          };
        }
      });

      const motorReportsData = await Promise.all(motorReportsPromises);
      setMotorReports(motorReportsData);

      // Calculer les statistiques système globales
      const totalPredictions = motorReportsData.reduce((sum, m) => sum + m.predictionsCount, 0);
      const totalAnomalies = motorReportsData.reduce((sum, m) => sum + m.anomaliesCount, 0);
      const criticalAnomalies = motorReportsData.filter(m => m.riskLevel === 'critical').length;

      const systemReport: SystemReportData = {
        totalPredictions,
        totalAnomalies,
        criticalAnomalies,
        systemUptime: 99.2, // À calculer depuis les logs système
        maintenanceEvents: motorReportsData.filter(m => m.riskLevel === 'high' || m.riskLevel === 'critical').length,
        averageResponseTime: 15.8, // À récupérer depuis les métriques serveur
        dataQuality: motorReportsData.length > 0 ? 
          (motorReportsData.filter(m => m.predictionsCount > 0).length / motorReportsData.length) * 100 : 0,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString()
      };

      setReportData(systemReport);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Erreur chargement données rapport:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [selectedPeriod, motors]);


  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      default: return 'default';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'stable': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const averageHealthScore = motorReports.length > 0 
    ? motorReports.reduce((sum, m) => sum + m.healthScore, 0) / motorReports.length 
    : 0;

  const exportToPDF = (reportType: string) => {
    console.log(`Export PDF ${reportType} pour période ${selectedPeriod}`);
    // Ici, implémenter la génération PDF avec les vraies données
  };

  if (isLoading && !reportData) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Génération du rapport en cours...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Résumé exécutif dynamique */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Résumé Exécutif - Maintenance Prédictive</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Dernière mise à jour: {lastUpdate.toLocaleString('fr-FR')}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reportData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold">État Global du Parc</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Score de santé moyen</span>
                    <span className="font-medium">{Math.round(averageHealthScore)}%</span>
                  </div>
                  <Progress value={averageHealthScore} className="h-2" />
                  <div className="text-sm text-muted-foreground">
                    {averageHealthScore > 80 ? 'Excellent' : 
                     averageHealthScore > 60 ? 'Bon' : 
                     averageHealthScore > 40 ? 'Moyen' : 'Critique'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Basé sur {reportData.totalPredictions} prédictions analysées
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Alertes Actives</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total anomalies</span>
                    <Badge variant="outline">{reportData.totalAnomalies}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Équipements critiques</span>
                    <Badge variant="destructive">{reportData.criticalAnomalies}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Interventions requises</span>
                    <Badge variant="secondary">{reportData.maintenanceEvents}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Période: {selectedPeriod === 'week' ? '7 derniers jours' : 
                             selectedPeriod === 'month' ? '30 derniers jours' : 
                             '90 derniers jours'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Métriques Système</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Disponibilité système</span>
                    <span className="font-medium">{reportData.systemUptime.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Qualité des données</span>
                    <span className="font-medium">{Math.round(reportData.dataQuality)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Temps de réponse moyen</span>
                    <span className="font-medium">{reportData.averageResponseTime}ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sélection de période */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Période d'Analyse</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadReportData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['week', 'month', 'quarter'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                disabled={isLoading}
              >
                {period === 'week' ? 'Semaine' : 
                 period === 'month' ? 'Mois' : 'Trimestre'}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rapports détaillés par moteur */}
      <Card>
        <CardHeader>
          <CardTitle>Rapport Détaillé par Équipement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {motorReports.map((motor) => (
              <div key={motor.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{motor.name}</h3>
                    <p className="text-sm text-muted-foreground">{motor.location}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(motor.trend)}
                    <Badge variant={getRiskBadgeVariant(motor.riskLevel)}>
                      Score: {motor.healthScore}%
                    </Badge>
                    <Badge variant="outline">
                      {motor.predictionsCount} prédictions
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Métriques Actuelles</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Température:</span>
                        <span>{motor.currentMetrics.temperature.toFixed(1)}°C</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vibration:</span>
                        <span>{motor.currentMetrics.vibration.toFixed(3)}g</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Son:</span>
                        <span>{motor.currentMetrics.sound.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Analyse Période</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Anomalies détectées:</span>
                        <span className={motor.anomaliesCount > 0 ? 'text-red-600 font-medium' : ''}>
                          {motor.anomaliesCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Niveau de risque:</span>
                        <Badge variant={getRiskBadgeVariant(motor.riskLevel)} className="text-xs">
                          {motor.riskLevel}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Tendance:</span>
                        <span className="flex items-center">
                          {getTrendIcon(motor.trend)}
                          <span className="ml-1 capitalize">{motor.trend}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Recommandations</h4>
                    <div className="space-y-1">
                      {motor.recommendations.map((rec, index) => (
                        <div key={index} className="text-xs text-muted-foreground">
                          • {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {motor.riskLevel === 'critical' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Attention critique: Ce moteur nécessite une intervention immédiate
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}

            {motorReports.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucune donnée disponible pour la période sélectionnée</p>
                <p className="text-sm">Vérifiez la connexion des capteurs</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Types de rapports disponibles */}
      <Card>
        <CardHeader>
          <CardTitle>Rapports Exportables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Rapport de Performance</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Analyse détaillée des performances sur la période sélectionnée
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => exportToPDF('performance')}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <PieChart className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Rapport d'Anomalies</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Synthèse des anomalies détectées et actions correctives
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => exportToPDF('anomalies')}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Planning de Maintenance</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Recommandations et planification des interventions
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => exportToPDF('maintenance')}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};